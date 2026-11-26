"use client";

import { useEffect } from "react";

import { useActionForm } from "@/shared/hooks/use-action-form";
import { AlertBanner, Button, FormField, Modal, TextInput } from "@/shared/ui";

import { RenameProjectInput } from "../domain/schemas";
import { renameProjectAction } from "./actions";

export interface EditProjectTarget {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
}

export interface EditProjectDialogProps {
  readonly project: EditProjectTarget | null;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

export function EditProjectDialog({ project, onClose, onUpdated }: EditProjectDialogProps) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: RenameProjectInput,
    defaultValues: {
      id: project?.id ?? "",
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
    action: renameProjectAction,
    onSuccess: () => {
      onClose();
      onUpdated();
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        id: project.id,
        name: project.name,
        description: project.description ?? "",
      });
    }
  }, [project, form]);

  return (
    <Modal
      isOpen={Boolean(project)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Chỉnh sửa dự án"
      description="Cập nhật tên và mô tả cho dự án."
    >
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        <input type="hidden" {...form.register("id")} />
        <FormField label="Tên dự án" isRequired error={form.formState.errors.name?.message}>
          <TextInput placeholder="Ví dụ: Skin1004 Centella" {...form.register("name")} />
        </FormField>

        <FormField label="Mô tả ngắn" error={form.formState.errors.description?.message}>
          <TextInput
            placeholder="Ghi chú ngắn về dự án hoặc chiến dịch"
            {...form.register("description")}
          />
        </FormField>

        {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onPress={onClose} isDisabled={isSubmitting}>
            Huỷ
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
