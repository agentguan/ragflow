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

import contextvars

# Request-scoped ACL context. Kept in a dependency-free module so that both the
# API layer (which computes the values) and the retrieval layer (which consumes
# them) can import it without pulling the api package into the rag search path.
#
# ``_acl_user_id`` identifies the authenticated user of the current request.
# ``_acl_denied_doc_ids`` is the pre-computed set of document ids this user is
# *denied* from reading (documents that have document_acl rows but none granting
# the user, directly or via a group). It is a ``frozenset``; ``None``/empty means
# "no restriction / not authenticated".
# ``_acl_denied_kb_ids`` is the set of knowledge base ids that contain at least
# one denied document; knowledge-graph retrieval (whose rows are KB-scoped, not
# document-scoped) uses it to suppress KB-wide graph summaries that could leak
# denied content.

_acl_user_id: contextvars.ContextVar = contextvars.ContextVar("ragflow_acl_user_id", default=None)
_acl_denied_doc_ids: contextvars.ContextVar = contextvars.ContextVar("ragflow_acl_denied_doc_ids", default=None)
_acl_denied_kb_ids: contextvars.ContextVar = contextvars.ContextVar("ragflow_acl_denied_kb_ids", default=None)


def set_acl_context(user_id: str | None, denied_doc_ids: frozenset | None, denied_kb_ids: frozenset | None = None) -> None:
    _acl_user_id.set(user_id)
    _acl_denied_doc_ids.set(denied_doc_ids)
    _acl_denied_kb_ids.set(denied_kb_ids)


def reset_acl_context() -> None:
    _acl_user_id.set(None)
    _acl_denied_doc_ids.set(None)
    _acl_denied_kb_ids.set(None)


def get_acl_user_id() -> str | None:
    return _acl_user_id.get()


def get_acl_denied_doc_ids() -> frozenset | None:
    return _acl_denied_doc_ids.get()


def get_acl_denied_kb_ids() -> frozenset | None:
    return _acl_denied_kb_ids.get()