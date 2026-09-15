/*
 *  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  useCreateDocumentGroup,
  useFetchDocumentGroups,
  useFetchDocumentPermission,
} from '@/hooks/use-document-request';
import { useListTenantUser } from '@/hooks/use-user-setting-request';
import {
  DocumentAclPrincipalType,
  IDocumentAclPrincipal,
} from '@/interfaces/database/document';
import { ISetDocumentPermissionRequestBody } from '@/interfaces/request/document';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

interface DocumentPermissionDialogProps {
  datasetId?: string;
  documentId?: string;
  loading: boolean;
  hideModal: () => void;
  onOk: (principals: ISetDocumentPermissionRequestBody['principals']) => void;
}

type PrincipalInput = ISetDocumentPermissionRequestBody['principals'][number];

export function DocumentPermissionDialog({
  datasetId,
  documentId,
  loading,
  hideModal,
  onOk,
}: DocumentPermissionDialogProps) {
  const { t } = useTranslation();
  const { data: permission } = useFetchDocumentPermission(
    datasetId,
    documentId,
  );
  const { data: tenantUsers } = useListTenantUser();
  const { data: groups, refetch: refetchGroups } = useFetchDocumentGroups();
  const { createGroup, loading: creatingGroup } = useCreateDocumentGroup();

  const [originPrincipals, setOriginPrincipals] = useState<
    IDocumentAclPrincipal[]
  >([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (permission) {
      setOriginPrincipals(permission.principals ?? []);
      setSelectedUserIds(
        (permission.principals ?? [])
          .filter((p) => p.principal_type === 'user')
          .map((p) => p.principal_id),
      );
      setSelectedGroupIds(
        (permission.principals ?? [])
          .filter((p) => p.principal_type === 'group')
          .map((p) => p.principal_id),
      );
    }
  }, [permission]);

  const userOptions = useMemo(
    () =>
      tenantUsers.map((u) => ({
        label: u.nickname || u.email || u.user_id,
        value: u.user_id,
      })),
    [tenantUsers],
  );

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        label: `${g.name} (${g.member_count})`,
        value: g.id,
      })),
    [groups],
  );

  const knownUserIds = useMemo(
    () => new Set(tenantUsers.map((u) => u.user_id)),
    [tenantUsers],
  );

  const knownGroupIds = useMemo(
    () => new Set(groups.map((g) => g.id)),
    [groups],
  );

  // Principals that are no longer present in the candidate lists (e.g. a
  // deleted group) are preserved verbatim so saving never silently drops them.
  const orphanPrincipals = useMemo(
    () =>
      originPrincipals.filter((p) => {
        if (p.principal_type === 'user') {
          return !knownUserIds.has(p.principal_id);
        }
        return !knownGroupIds.has(p.principal_id);
      }),
    [originPrincipals, knownUserIds, knownGroupIds],
  );

  const handleSave = useCallback(() => {
    const next: PrincipalInput[] = [
      ...orphanPrincipals.map((p) => ({
        principal_type: p.principal_type as DocumentAclPrincipalType,
        principal_id: p.principal_id,
      })),
      ...selectedUserIds.map((id) => ({
        principal_type: 'user' as const,
        principal_id: id,
      })),
      ...selectedGroupIds.map((id) => ({
        principal_type: 'group' as const,
        principal_id: id,
      })),
    ];
    onOk(next);
  }, [orphanPrincipals, selectedUserIds, selectedGroupIds, onOk]);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      return;
    }
    const result = await createGroup({
      name,
      userIds: newGroupMemberIds,
    });
    if (result?.code === 0) {
      setNewGroupName('');
      setNewGroupMemberIds([]);
      refetchGroups();
    }
  }, [createGroup, newGroupMemberIds, newGroupName, refetchGroups]);

  const handleGroupNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setNewGroupName(e.target.value);
    },
    [],
  );

  const hasPrincipals =
    orphanPrincipals.length > 0 ||
    selectedUserIds.length > 0 ||
    selectedGroupIds.length > 0;

  return (
    <Dialog open onOpenChange={hideModal}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {t('knowledgeDetails.permissionManagement')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t('knowledgeDetails.permissionUsers')}
            </div>
            <MultiSelect
              options={userOptions}
              defaultValue={selectedUserIds}
              onValueChange={setSelectedUserIds}
              placeholder={t('knowledgeDetails.permissionUsers')}
              maxCount={6}
              modalPopover
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t('knowledgeDetails.permissionGroups')}
            </div>
            <MultiSelect
              options={groupOptions}
              defaultValue={selectedGroupIds}
              onValueChange={setSelectedGroupIds}
              placeholder={t('knowledgeDetails.permissionGroups')}
              maxCount={6}
              modalPopover
            />
          </div>

          <div className="space-y-2 rounded-md border border-border-button p-3">
            <div className="text-sm font-medium">
              {t('knowledgeDetails.permissionCreateGroup')}
            </div>
            <div className="flex flex-col gap-2">
              <Input
                value={newGroupName}
                onChange={handleGroupNameChange}
                placeholder={t('knowledgeDetails.permissionGroupName')}
                data-testid="group-name-input"
              />
              <MultiSelect
                options={userOptions}
                defaultValue={newGroupMemberIds}
                onValueChange={setNewGroupMemberIds}
                placeholder={t('knowledgeDetails.permissionGroupMembers')}
                maxCount={6}
                modalPopover
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!newGroupName.trim() || creatingGroup}
                onClick={handleCreateGroup}
                data-testid="group-create"
                className="self-start"
              >
                {t('knowledgeDetails.permissionAddGroup')}
              </Button>
            </div>
          </div>

          {orphanPrincipals.length > 0 && (
            <div className="text-xs text-text-secondary">
              {t('knowledgeDetails.permissionUnavailable')}:{' '}
              {orphanPrincipals.map((p) => p.name).join(', ')}
            </div>
          )}

          {!hasPrincipals && (
            <div className="text-xs text-text-secondary">
              {t('knowledgeDetails.permissionEmptyHint')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={hideModal}
            data-testid="permission-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            loading={loading}
            data-testid="permission-save"
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}