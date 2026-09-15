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
import { MultiSelect } from '@/components/ui/multi-select';
import {
  useFetchAppGroupMembers,
  useFetchAppUsers,
  useSetAppGroupMembers,
} from '@/hooks/use-document-request';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MembersDialogProps {
  groupId: string;
  hideModal: () => void;
}

export function MembersDialog({ groupId, hideModal }: MembersDialogProps) {
  const { t } = useTranslation();
  const { data: appUsers } = useFetchAppUsers();
  const { data: members } = useFetchAppGroupMembers(groupId);
  const { setAppGroupMembers, loading } = useSetAppGroupMembers();

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected((members ?? []).map((m) => m.user_id));
  }, [members]);

  const userOptions = useMemo(
    () => appUsers.map((u) => ({ label: u.name, value: u.id })),
    [appUsers],
  );

  const handleSave = useCallback(async () => {
    const code = await setAppGroupMembers({ groupId, userIds: selected });
    if (code === 0) {
      hideModal();
    }
  }, [groupId, selected, setAppGroupMembers, hideModal]);

  return (
    <Dialog open onOpenChange={hideModal}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('accessControl.manageMembers')}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <MultiSelect
            options={userOptions}
            defaultValue={selected}
            onValueChange={setSelected}
            placeholder={t('accessControl.members')}
            maxCount={6}
            modalPopover
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={hideModal}
            data-testid="members-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            loading={loading}
            data-testid="members-save"
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}