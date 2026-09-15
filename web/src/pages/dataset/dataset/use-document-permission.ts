import { useSetModalState } from '@/hooks/common-hooks';
import { useSetDocumentPermission } from '@/hooks/use-document-request';
import { IDocumentInfo } from '@/interfaces/database/document';
import { ISetDocumentPermissionRequestBody } from '@/interfaces/request/document';
import { useCallback, useState } from 'react';

export const useDocumentPermission = () => {
  const { setDocumentPermission, loading } = useSetDocumentPermission();
  const [record, setRecord] = useState<IDocumentInfo>();

  const {
    visible: permissionVisible,
    hideModal: hidePermissionModal,
    showModal: showPermissionModal,
  } = useSetModalState();

  const onPermissionOk = useCallback(
    async (principals: ISetDocumentPermissionRequestBody['principals']) => {
      if (record?.id && record?.dataset_id) {
        const ret = await setDocumentPermission({
          datasetId: record.dataset_id,
          documentId: record.id,
          principals,
        });
        if (ret === 0) {
          hidePermissionModal();
        }
      }
    },
    [record?.id, record?.dataset_id, setDocumentPermission, hidePermissionModal],
  );

  const handleShow = useCallback(
    (row: IDocumentInfo) => {
      setRecord(row);
      showPermissionModal();
    },
    [showPermissionModal],
  );

  return {
    permissionLoading: loading,
    onPermissionOk,
    permissionVisible,
    hidePermissionModal,
    showPermissionModal: handleShow,
    permissionDocumentId: record?.id,
    permissionDatasetId: record?.dataset_id,
  };
};

export type UseDocumentPermissionShowType = Pick<
  ReturnType<typeof useDocumentPermission>,
  'showPermissionModal'
>;