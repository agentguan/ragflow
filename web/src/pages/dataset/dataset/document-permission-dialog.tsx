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
import { MultiSelect } from '@/components/ui/multi-select';
import {
  useFetchAppGroups,
  useFetchAppUsers,
  useFetchDocumentPermission,
} from '@/hooks/use-document-request';
import {
  DocumentAclPrincipalType,
  IDocumentAclPrincipal,
} from '@/interfaces/database/document';
import { ISetDocumentPermissionRequestBody } from '@/interfaces/request/document';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { data: appUsers } = useFetchAppUsers();
  const { data: appGroups } = useFetchAppGroups();

  const [originPrincipals, setOriginPrincipals] = useState<
    IDocumentAclPrincipal[]
  >([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

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
    () => appUsers.map((u) => ({ label: u.name, value: u.id })),
    [appUsers],
  );

  const groupOptions = useMemo(
    () =>
      appGroups.map((g) => ({
        label: `${g.name} (${g.member_count})`,
        value: g.id,
      })),
    [appGroups],
  );

  const knownUserIds = useMemo(
    () => new Set(appUsers.map((u) => u.id)),
    [appUsers],
  );

  const knownGroupIds = useMemo(
    () => new Set(appGroups.map((g) => g.id)),
    [appGroups],
  );

  // Principals that are no longer present in the candidate lists (e.g. a
  // deleted app user/group) are preserved verbatim so saving never drops them.
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