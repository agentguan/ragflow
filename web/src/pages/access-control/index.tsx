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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MembersDialog } from './members-dialog';

const MAX_VISIBLE_GROUPS = 3;

const groupChipClass =
  'inline-flex items-center rounded-full border border-border-button bg-bg-base px-2 py-0.5 text-xs text-text-secondary';

function UserGroupTags({ groups }: { groups: IAppUserGroup[] }) {
  const { t } = useTranslation();

  if (groups.length === 0) {
    return (
      <div className="mt-1.5 text-xs text-text-disabled">
        {t('accessControl.noGroups')}
      </div>
    );
  }

  const visibleGroups = groups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenGroups = groups.slice(MAX_VISIBLE_GROUPS);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="text-xs text-text-disabled">
        {t('accessControl.userGroups')}
      </span>
      {visibleGroups.map((group) => (
        <span key={group.id} className={groupChipClass}>
          {group.name}
        </span>
      ))}
      {hiddenGroups.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={groupChipClass} tabIndex={0}>
              +{hiddenGroups.length}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {hiddenGroups.map((group) => group.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

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

  const userGroupMap = useMemo(() => {
    const map = new Map<string, IAppUserGroup[]>();
    for (const group of appGroups) {
      for (const userId of group.member_ids ?? []) {
        const groups = map.get(userId);
        if (groups) {
          groups.push(group);
        } else {
          map.set(userId, [group]);
        }
      }
    }
    return map;
  }, [appGroups]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t('accessControl.title')}
      </h1>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-lg border border-border-button bg-bg-card">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-button p-4">
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

          <div className="max-h-[60vh] overflow-y-auto p-4">
            {appUsers.length === 0 ? (
              <div className="py-4 text-sm text-text-secondary">
                {t('accessControl.emptyUsers')}
              </div>
            ) : (
              <ul className="divide-y divide-border-button">
                {appUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-primary break-words">
                        {u.name}
                      </div>
                      {u.email ? (
                        <div className="text-xs text-text-secondary break-words">
                          {u.email}
                        </div>
                      ) : null}
                      <UserGroupTags
                        groups={userGroupMap.get(u.id) ?? []}
                      />
                    </div>
                    <div className="shrink-0">
                      <ConfirmDeleteDialog onOk={handleDeleteUser(u)}>
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
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-lg border border-border-button bg-bg-card">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-button p-4">
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

          <div className="max-h-[60vh] overflow-y-auto p-4">
            {appGroups.length === 0 ? (
              <div className="py-4 text-sm text-text-secondary">
                {t('accessControl.emptyGroups')}
              </div>
            ) : (
              <ul className="divide-y divide-border-button">
                {appGroups.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-primary break-words">
                        {g.name}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {t('accessControl.memberCount', {
                          count: g.member_count,
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
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
          </div>
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