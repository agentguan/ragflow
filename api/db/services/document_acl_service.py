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
from api.db.db_models import DB, Document, DocumentACL, Knowledgebase, UserGroup, UserGroupMember, UserTenant
from api.db.services.common_service import CommonService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.user_service import UserService
from common.misc_utils import get_uuid


class DocumentAclPrincipalType:
    USER = "user"
    GROUP = "group"
    VALID = {USER, GROUP}


class DocumentAclPermission:
    READ = "read"
    VALID = {READ}


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
                users = list(UserService.query(id=r.principal_id))
                if users:
                    u = users[0]
                    entry["name"] = u.nickname or u.email or r.principal_id
                    entry["email"] = u.email or ""
            else:
                groups = list(UserGroupService.query(id=r.principal_id))
                if groups:
                    entry["name"] = groups[0].name or r.principal_id
            result.append(entry)
        return result

    @classmethod
    @DB.connection_context()
    def replace_principals(cls, document_id: str, principals: list[dict], tenant_id: str, created_by: str) -> None:
        """Atomically replace the ACL entries of a document.

        ``principals`` is a list of ``{"principal_type": "user"|"group", "principal_id": "<id>"}``.
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


class UserGroupService(CommonService):
    model = UserGroup

    @classmethod
    @DB.connection_context()
    def list_with_member_count(cls, tenant_id: str) -> list[dict]:
        groups = list(cls.query(tenant_id=tenant_id))
        member_counts = {}
        if groups:
            rows = list(
                UserGroupMember.select(UserGroupMember.group_id).where(
                    UserGroupMember.group_id.in_([g.id for g in groups])
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
    def delete_group(cls, group_id: str) -> None:
        with DB.atomic():
            DocumentACL.delete().where(
                (DocumentACL.principal_type == DocumentAclPrincipalType.GROUP) & (DocumentACL.principal_id == group_id)
            ).execute()
            UserGroupMember.delete().where(UserGroupMember.group_id == group_id).execute()
            cls.model.delete().where(cls.model.id == group_id).execute()


class UserGroupMemberService(CommonService):
    model = UserGroupMember

    @classmethod
    @DB.connection_context()
    def list_members(cls, group_id: str) -> list[dict]:
        result = []
        for r in list(cls.query(group_id=group_id)):
            entry = {"group_id": r.group_id, "user_id": r.user_id, "name": r.user_id, "email": ""}
            users = list(UserService.query(id=r.user_id))
            if users:
                u = users[0]
                entry["name"] = u.nickname or u.email or r.user_id
                entry["email"] = u.email or ""
            result.append(entry)
        return result

    @classmethod
    @DB.connection_context()
    def set_members(cls, group_id: str, user_ids: list[str]) -> None:
        with DB.atomic():
            cls.model.delete().where(cls.model.group_id == group_id).execute()
            for uid in dict.fromkeys(user_ids):
                cls.model.create(id=get_uuid(), group_id=group_id, user_id=str(uid))


@DB.connection_context()
def get_user_group_ids(user_id: str) -> list[str]:
    return [r.group_id for r in UserGroupMember.select(UserGroupMember.group_id).where(UserGroupMember.user_id == user_id)]


@DB.connection_context()
def compute_denied_doc_ids(user_id: str) -> frozenset:
    """Compute the set of document ids the user is denied from reading.

    A document is denied when it has at least one ``document_acl`` row but none
    of those rows grant the user (directly or through one of the user's groups).
    Documents without any ACL row stay readable (the pre-ACL behaviour).

    The document creator and the owning knowledge base's tenant owner always
    retain read access, so restricting a document can never lock its own
    author/owner out.
    """
    granted: set[str] = set()
    for r in DocumentACL.select(DocumentACL.document_id).where(
        DocumentACL.principal_type == DocumentAclPrincipalType.USER,
        DocumentACL.principal_id == user_id,
        DocumentACL.permission == DocumentAclPermission.READ,
    ):
        granted.add(r.document_id)

    group_ids = get_user_group_ids(user_id)
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

    denied = restricted - granted
    if not denied:
        return frozenset()

    # Safety net: never deny the document creator or the owner of the document's
    # knowledge base. This is a small bounded set (only restricted docs without
    # an explicit grant to this user).
    exempt: set[str] = set()
    docs = list(Document.select(Document.id, Document.created_by, Document.kb_id).where(Document.id.in_(list(denied))))
    kb_ids = set()
    for d in docs:
        if d.created_by == user_id:
            exempt.add(d.id)
        else:
            kb_ids.add(d.kb_id)
    if kb_ids:
        owned_kb_ids = {
            kb.id
            for kb in Knowledgebase.select(Knowledgebase.id).where(
                Knowledgebase.tenant_id == user_id,
                Knowledgebase.id.in_(list(kb_ids)),
            )
        }
        for d in docs:
            if d.kb_id in owned_kb_ids:
                exempt.add(d.id)

    return frozenset(denied - exempt)


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
def can_manage_document(document: dict | Document, user_id: str) -> bool:
    """Whether ``user_id`` may manage (view/replace) the ACL of a document."""
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