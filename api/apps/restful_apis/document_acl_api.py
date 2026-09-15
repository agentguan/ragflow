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

from api.apps import current_user, login_required
from api.db.services.document_acl_service import (
    DocumentAclPrincipalType,
    DocumentAclService,
    UserGroupMemberService,
    UserGroupService,
    can_manage_document,
)
from api.db.services.document_service import DocumentService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.utils.api_utils import get_data_error_result, get_error_argument_result, get_json_result, get_request_json
from common.constants import RetCode
from common.misc_utils import get_uuid


def _not_found_result(message="Not found."):
    return get_data_error_result(message=message, code=RetCode.NOT_FOUND)


def _permission_denied_result(message="You are not allowed to manage this document's permission."):
    return get_data_error_result(message=message, code=RetCode.PERMISSION_ERROR)


@manager.route("/datasets/<dataset_id>/documents/<document_id>/permission", methods=["GET"])  # noqa: F821
@login_required
async def get_document_permission(dataset_id, document_id):
    ok, doc = DocumentService.get_by_id(document_id)
    if not ok or doc.kb_id != dataset_id:
        return _not_found_result(message="Document not found.")
    if not can_manage_document(doc, current_user.id):
        return _permission_denied_result()
    return get_json_result(data={"document_id": document_id, "principals": DocumentAclService.list_principals(document_id)})


@manager.route("/datasets/<dataset_id>/documents/<document_id>/permission", methods=["PUT"])  # noqa: F821
@login_required
async def set_document_permission(dataset_id, document_id):
    ok, doc = DocumentService.get_by_id(document_id)
    if not ok or doc.kb_id != dataset_id:
        return _not_found_result(message="Document not found.")
    if not can_manage_document(doc, current_user.id):
        return _permission_denied_result()

    req = await get_request_json()
    principals = req.get("principals") or []
    if not isinstance(principals, list):
        return get_error_argument_result(message="`principals` must be a list.")

    cleaned = []
    for p in principals:
        if not isinstance(p, dict):
            return get_error_argument_result(message="Each principal must be an object.")
        pt = p.get("principal_type")
        pid = p.get("principal_id")
        if pt not in DocumentAclPrincipalType.VALID or not pid:
            return get_error_argument_result(message="Each principal needs a valid `principal_type` and `principal_id`.")
        cleaned.append({"principal_type": pt, "principal_id": str(pid)})

    ok_kb, kb = KnowledgebaseService.get_by_id(doc.kb_id)
    tenant_id = kb.tenant_id if ok_kb else current_user.id
    DocumentAclService.replace_principals(document_id, cleaned, tenant_id, current_user.id)
    return get_json_result(data={"document_id": document_id, "principals": DocumentAclService.list_principals(document_id)})


@manager.route("/groups", methods=["GET"])  # noqa: F821
@login_required
async def list_groups():
    return get_json_result(data=UserGroupService.list_with_member_count(current_user.id))


@manager.route("/groups", methods=["POST"])  # noqa: F821
@login_required
async def create_group():
    req = await get_request_json()
    name = (req.get("name") or "").strip()
    if not name:
        return get_error_argument_result(message="`name` is required.")
    group_id = get_uuid()
    UserGroupService.save(id=group_id, tenant_id=current_user.id, name=name, created_by=current_user.id)
    return get_json_result(data={"id": group_id, "tenant_id": current_user.id, "name": name})


@manager.route("/groups/<group_id>", methods=["GET"])  # noqa: F821
@login_required
async def get_group(group_id):
    ok, group = UserGroupService.get_by_id(group_id)
    if not ok or group.tenant_id != current_user.id:
        return _not_found_result(message="Group not found.")
    return get_json_result(data={"id": group.id, "name": group.name, "members": UserGroupMemberService.list_members(group_id)})


@manager.route("/groups/<group_id>/members", methods=["PUT"])  # noqa: F821
@login_required
async def set_group_members(group_id):
    ok, group = UserGroupService.get_by_id(group_id)
    if not ok or group.tenant_id != current_user.id:
        return _not_found_result(message="Group not found.")
    req = await get_request_json()
    user_ids = req.get("user_ids") or []
    if not isinstance(user_ids, list):
        return get_error_argument_result(message="`user_ids` must be a list.")
    UserGroupMemberService.set_members(group_id, [str(u) for u in user_ids if u])
    return get_json_result(data={"members": UserGroupMemberService.list_members(group_id)})


@manager.route("/groups/<group_id>", methods=["DELETE"])  # noqa: F821
@login_required
async def delete_group(group_id):
    ok, group = UserGroupService.get_by_id(group_id)
    if not ok or group.tenant_id != current_user.id:
        return _not_found_result(message="Group not found.")
    UserGroupService.delete_group(group_id)
    return get_json_result(data=True)