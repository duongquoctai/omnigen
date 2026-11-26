"use client";

import { useEffect } from "react";

import { useActionForm } from "@/shared/hooks/use-action-form";
import { AlertBanner, Button, FormField, Modal, TextInput } from "@/shared/ui";

import { RenameFolderInput } from "../domain/schemas";
import { renameFolderAction } from "./actions";

export interface EditFolderTarget {
  readonly id: string;
  readonly name: string;
}

export interface EditFolderDialogProps {
  readonly projectId: string;
  readonly folder: EditFolderTarget | null;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

export function EditFolderDialog({ projectId, folder, onClose, onUpdated }: EditFolderDialogProps) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: RenameFolderInput,
    defaultValues: {
      id: folder?.id ?? "",
      projectId,
      name: folder?.name ?? "",
    },
    action: renameFolderAction,
    onSuccess: () => {
      onClose();
      onUpdated();
    },
  });

  useEffect(() => {
    if (folder) {
      form.reset({
        id: folder.id,
        projectId,
        name: folder.name,
      });
    }
  }, [folder, projectId, form]);

  return (
    <Modal
      isOpen={Boolean(folder)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Đổi tên thư mục"
      description="Cập nhật tên hiển thị cho thư mục làm việc."
    >
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        <input type="hidden" {...form.register("id")} />
        <input type="hidden" {...form.register("projectId")} />
        <FormField label="Tên thư mục" isRequired error={form.formState.errors.name?.message}>
          <TextInput placeholder="Ví dụ: Video review tháng 11" {...form.register("name")} />
        </FormField>

        {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onPress={onClose} isDisabled={isSubmitting}>
            Huỷ
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Lưu tên mới
          </Button>
        </div>
      </form>
    </Modal>
  );
}
