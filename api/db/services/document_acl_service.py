#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import logging

from api.db import UserTenantRole
from api.db.db_models import (
    DB,
    AppUser,
    AppUserGroup,
    AppUserGroupMember,
    Document,
    DocumentACL,
    Knowledgebase,
    UserTenant,
)
from api.db.services.common_service import CommonService
from api.db.services.knowledgebase_service import KnowledgebaseService
from common.misc_utils import get_uuid


class DocumentAclPrincipalType:
    USER = "user"
    GROUP = "group"
    VALID = {USER, GROUP}


class DocumentAclPermission:
    READ = "read"
    VALID = {READ}


class AppUserService(CommonService):
    model = AppUser


class AppUserGroupService(CommonService):
    model = AppUserGroup


class AppUserGroupMemberService(CommonService):
    model = AppUserGroupMember


class DocumentAclService(CommonService):
    model = DocumentACL

    @classmethod
    @DB.connection_context()
    def list_principals(cls, document_id: str) -> list[dict]:
        """Return the ACL entries of a document enriched with display names."""
        result = []
        for r in list(cls.query(document_id=document_id)):
            entry = {
                "document_id": r.document_id,
                "principal_type": r.principal_type,
                "principal_id": r.principal_id,
                "permission": r.permission,
                "name": r.principal_id,
                "email": "",
            }
            if r.principal_type == DocumentAclPrincipalType.USER:
                users = list(AppUserService.query(id=r.principal_id))
                if users:
                    u = users[0]
                    entry["name"] = u.name or r.principal_id
                    entry["email"] = u.email or ""
            else:
                groups = list(AppUserGroupService.query(id=r.principal_id))
                if groups:
                    entry["name"] = groups[0].name or r.principal_id
            result.append(entry)
        return result

    @classmethod
    @DB.connection_context()
    def replace_principals(cls, document_id: str, principals: list[dict], tenant_id: str, created_by: str) -> None:
        """Atomically replace the ACL entries of a document.

        ``principals`` is a list of ``{"principal_type": "user"|"group", "principal_id": "<AppUser.id|AppUserGroup.id>"}``.
        """
        with DB.atomic():
            cls.model.delete().where(cls.model.document_id == document_id).execute()
            for p in principals:
                ptype = p.get("principal_type")
                pid = p.get("principal_id")
                if ptype not in DocumentAclPrincipalType.VALID or not pid:
                    continue
                cls.model.create(
                    id=get_uuid(),
                    document_id=document_id,
                    principal_type=ptype,
                    principal_id=str(pid),
                    permission=DocumentAclPermission.READ,
                    tenant_id=tenant_id,
                    created_by=created_by,
                )

    @classmethod
    @DB.connection_context()
    def delete_app_user(cls, user_id: str) -> None:
        """Delete an app user and any ACL/membership rows that reference it."""
        with DB.atomic():
            DocumentACL.delete().where(
                (DocumentACL.principal_type == DocumentAclPrincipalType.USER)
                & (DocumentACL.principal_id == user_id)
            ).execute()
            AppUserGroupMember.delete().where(AppUserGroupMember.user_id == user_id).execute()
            AppUser.delete().where(AppUser.id == user_id).execute()

    @classmethod
    @DB.connection_context()
    def delete_app_group(cls, group_id: str) -> None:
        """Delete an app-user group and any ACL/membership rows that reference it."""
        with DB.atomic():
            DocumentACL.delete().where(
                (DocumentACL.principal_type == DocumentAclPrincipalType.GROUP)
                & (DocumentACL.principal_id == group_id)
            ).execute()
            AppUserGroupMember.delete().where(AppUserGroupMember.group_id == group_id).execute()
            AppUserGroup.delete().where(AppUserGroup.id == group_id).execute()

    @classmethod
    @DB.connection_context()
    def list_groups(cls, tenant_id: str) -> list[dict]:
        """List app-user groups of a tenant enriched with member count."""
        groups = list(AppUserGroupService.query(tenant_id=tenant_id))
        member_counts: dict[str, int] = {}
        if groups:
            rows = list(
                AppUserGroupMember.select(AppUserGroupMember.group_id).where(
                    AppUserGroupMember.group_id.in_([g.id for g in groups])
                )
            )
            for row in rows:
                member_counts[row.group_id] = member_counts.get(row.group_id, 0) + 1
        return [
            {
                "id": g.id,
                "tenant_id": g.tenant_id,
                "name": g.name,
                "created_by": g.created_by,
                "member_count": member_counts.get(g.id, 0),
            }
            for g in groups
        ]

    @classmethod
    @DB.connection_context()
    def list_members(cls, group_id: str) -> list[dict]:
        """List app-user members of a group enriched with display names."""
        result = []
        for r in list(AppUserGroupMemberService.query(group_id=group_id)):
            entry = {"group_id": r.group_id, "user_id": r.user_id, "name": r.user_id, "email": ""}
            users = list(AppUserService.query(id=r.user_id))
            if users:
                u = users[0]
                entry["name"] = u.name or r.user_id
                entry["email"] = u.email or ""
            result.append(entry)
        return result

    @classmethod
    @DB.connection_context()
    def set_members(cls, group_id: str, user_ids: list[str]) -> None:
        """Atomically replace the app-user membership of a group."""
        with DB.atomic():
            AppUserGroupMember.delete().where(AppUserGroupMember.group_id == group_id).execute()
            for uid in dict.fromkeys(user_ids):
                AppUserGroupMember.create(id=get_uuid(), group_id=group_id, user_id=str(uid))


@DB.connection_context()
def get_app_user_group_ids(app_user_id: str) -> list[str]:
    return [
        r.group_id
        for r in AppUserGroupMember.select(AppUserGroupMember.group_id).where(
            AppUserGroupMember.user_id == app_user_id
        )
    ]


@DB.connection_context()
def compute_app_user_denied_doc_ids(app_user_id: str) -> frozenset:
    """Compute the document ids the app user is denied from reading.

    A document is denied when it has at least one ``document_acl`` row but none
    of those rows grant the app user (directly or through one of its groups).
    Documents without any ACL row stay readable (the pre-ACL behaviour). Unlike
    the RAGFlow ``User``, an app user is never the creator or owner of a
    document, so no creator/owner exemption applies.
    """
    granted: set[str] = set()
    for r in DocumentACL.select(DocumentACL.document_id).where(
        DocumentACL.principal_type == DocumentAclPrincipalType.USER,
        DocumentACL.principal_id == app_user_id,
        DocumentACL.permission == DocumentAclPermission.READ,
    ):
        granted.add(r.document_id)

    group_ids = get_app_user_group_ids(app_user_id)
    if group_ids:
        for r in DocumentACL.select(DocumentACL.document_id).where(
            DocumentACL.principal_type == DocumentAclPrincipalType.GROUP,
            DocumentACL.principal_id.in_(group_ids),
            DocumentACL.permission == DocumentAclPermission.READ,
        ):
            granted.add(r.document_id)

    restricted: set[str] = set()
    for r in DocumentACL.select(DocumentACL.document_id).distinct():
        restricted.add(r.document_id)

    return frozenset(restricted - granted)


@DB.connection_context()
def compute_denied_kb_ids(denied_doc_ids: frozenset | set) -> frozenset:
    """Map a set of denied document ids to their knowledge base ids."""
    if not denied_doc_ids:
        return frozenset()
    return frozenset(
        r.kb_id
        for r in Document.select(Document.kb_id).where(Document.id.in_(list(denied_doc_ids)))
    )


@DB.connection_context()
def get_app_user(tenant_id: str, app_user_id: str) -> AppUser | None:
    """Fetch an app user scoped to ``tenant_id`` (``None`` when absent/mismatched)."""
    users = list(AppUser.select().where(AppUser.id == app_user_id, AppUser.tenant_id == tenant_id))
    return users[0] if users else None


@DB.connection_context()
def can_manage_document(document: dict | Document, user_id: str) -> bool:
    """Whether ``user_id`` (a RAGFlow user) may manage the ACL of a document."""
    doc = document.to_dict() if isinstance(document, Document) else document
    if doc.get("created_by") == user_id:
        return True

    kb_id = doc.get("kb_id")
    if not kb_id:
        return False
    ok, kb = KnowledgebaseService.get_by_id(kb_id)
    if not ok:
        return False
    kb = kb.to_dict() if isinstance(kb, Knowledgebase) else kb
    tenant_id = kb.get("tenant_id")
    if tenant_id == user_id:
        return True

    roles = list(
        UserTenant.select(UserTenant.role).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.status == "1",
        )
    )
    return any(r.role in (UserTenantRole.OWNER.value, UserTenantRole.ADMIN.value) for r in roles)