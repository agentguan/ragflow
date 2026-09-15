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

import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useCreateAppGroup,
  useCreateAppUser,
  useDeleteAppGroup,
  useDeleteAppUser,
  useFetchAppGroups,
  useFetchAppUsers,
} from '@/hooks/use-document-request';
import { IAppUser, IAppUserGroup } from '@/interfaces/database/document';
import { Plus, Trash2, Users } from 'lucide-react';
import { ChangeEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MembersDialog } from './members-dialog';

export default function AccessControlPage() {
  const { t } = useTranslation();
  const { data: appUsers } = useFetchAppUsers();
  const { data: appGroups } = useFetchAppGroups();
  const { createAppUser, loading: creatingUser } = useCreateAppUser();
  const { createAppGroup, loading: creatingGroup } = useCreateAppGroup();
  const { deleteAppUser } = useDeleteAppUser();
  const { deleteAppGroup } = useDeleteAppGroup();

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const openAddUser = useCallback(() => {
    setNewUserName('');
    setNewUserEmail('');
    setAddUserOpen(true);
  }, []);

  const openAddGroup = useCallback(() => {
    setNewGroupName('');
    setAddGroupOpen(true);
  }, []);

  const closeAddUser = useCallback(() => setAddUserOpen(false), []);
  const closeAddGroup = useCallback(() => setAddGroupOpen(false), []);

  const handleUserNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setNewUserName(e.target.value),
    [],
  );

  const handleUserEmailChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setNewUserEmail(e.target.value),
    [],
  );

  const handleGroupNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setNewGroupName(e.target.value),
    [],
  );

  const handleSaveUser = useCallback(async () => {
    const name = newUserName.trim();
    if (!name) {
      return;
    }
    const code = await createAppUser({ name, email: newUserEmail.trim() });
    if (code === 0) {
      closeAddUser();
    }
  }, [createAppUser, newUserEmail, newUserName, closeAddUser]);

  const handleSaveGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      return;
    }
    const code = await createAppGroup(name);
    if (code === 0) {
      closeAddGroup();
    }
  }, [createAppGroup, newGroupName, closeAddGroup]);

  const handleDeleteUser = useCallback(
    (user: IAppUser) => () => deleteAppUser(user.id),
    [deleteAppUser],
  );

  const handleDeleteGroup = useCallback(
    (group: IAppUserGroup) => () => deleteAppGroup(group.id),
    [deleteAppGroup],
  );

  const openMembers = useCallback(
    (groupId: string) => () => setEditingGroupId(groupId),
    [],
  );

  const closeMembers = useCallback(() => setEditingGroupId(null), []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t('accessControl.title')}
      </h1>

      <div className="space-y-8">
        <section className="rounded-lg border border-border-button bg-bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-text-primary">
              {t('accessControl.users')}
            </h2>
            <Button
              size="sm"
              onClick={openAddUser}
              data-testid="add-app-user"
            >
              <Plus className="size-4" />
              {t('accessControl.addUser')}
            </Button>
          </div>

          {appUsers.length === 0 ? (
            <div className="py-4 text-sm text-text-secondary">
              {t('accessControl.emptyUsers')}
            </div>
          ) : (
            <ul className="divide-y divide-border-button">
              {appUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm text-text-primary">{u.name}</div>
                    {u.email ? (
                      <div className="text-xs text-text-secondary">
                        {u.email}
                      </div>
                    ) : null}
                  </div>
                  <ConfirmDeleteDialog onOk={handleDeleteUser(u)}>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="size-[1em]" />
                    </Button>
                  </ConfirmDeleteDialog>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border-button bg-bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-text-primary">
              {t('accessControl.groups')}
            </h2>
            <Button
              size="sm"
              onClick={openAddGroup}
              data-testid="add-app-group"
            >
              <Plus className="size-4" />
              {t('accessControl.addGroup')}
            </Button>
          </div>

          {appGroups.length === 0 ? (
            <div className="py-4 text-sm text-text-secondary">
              {t('accessControl.emptyGroups')}
            </div>
          ) : (
            <ul className="divide-y divide-border-button">
              {appGroups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm text-text-primary">{g.name}</div>
                    <div className="text-xs text-text-secondary">
                      {t('accessControl.memberCount', {
                        count: g.member_count,
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('accessControl.manageMembers')}
                      onClick={openMembers(g.id)}
                    >
                      <Users className="size-[1em]" />
                    </Button>
                    <ConfirmDeleteDialog onOk={handleDeleteGroup(g)}>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="size-[1em]" />
                      </Button>
                    </ConfirmDeleteDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {addUserOpen && (
        <Dialog open onOpenChange={closeAddUser}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{t('accessControl.addUser')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input
                value={newUserName}
                onChange={handleUserNameChange}
                placeholder={t('accessControl.name')}
                data-testid="app-user-name"
              />
              <Input
                value={newUserEmail}
                onChange={handleUserEmailChange}
                placeholder={t('accessControl.email')}
                data-testid="app-user-email"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeAddUser}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSaveUser}
                loading={creatingUser}
                disabled={!newUserName.trim()}
                data-testid="app-user-save"
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {addGroupOpen && (
        <Dialog open onOpenChange={closeAddGroup}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{t('accessControl.addGroup')}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={newGroupName}
                onChange={handleGroupNameChange}
                placeholder={t('accessControl.name')}
                data-testid="app-group-name"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeAddGroup}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSaveGroup}
                loading={creatingGroup}
                disabled={!newGroupName.trim()}
                data-testid="app-group-save"
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingGroupId && (
        <MembersDialog groupId={editingGroupId} hideModal={closeMembers} />
      )}
    </div>
  );
}