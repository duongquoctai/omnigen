"use client";

import { useActionForm } from "@/shared/hooks/use-action-form";
import type { ActionResult } from "@/shared/types/action";
import { AlertBanner, Button, FormField, Modal, TextInput } from "@/shared/ui";

import { CreateProjectInput } from "../domain/schemas";

export interface CreateProjectDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreateProject: (input: CreateProjectInput) => Promise<ActionResult<unknown>>;
}

export function CreateProjectDialog({
  isOpen,
  onOpenChange,
  onCreateProject,
}: CreateProjectDialogProps) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: CreateProjectInput,
    defaultValues: { name: "", description: "" },
    action: onCreateProject,
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Tạo dự án mới"
      description="Tổ chức các thư mục làm việc theo từng sản phẩm hoặc chiến dịch."
    >
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        <FormField label="Tên dự án" error={form.formState.errors.name?.message} isRequired>
          <TextInput placeholder="Ví dụ: Skin1004 Centella" {...form.register("name")} />
        </FormField>
        <FormField label="Mô tả" error={form.formState.errors.description?.message}>
          <TextInput
            placeholder="Ghi chú ngắn (không bắt buộc)"
            {...form.register("description")}
          />
        </FormField>
        {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onPress={() => {
              onOpenChange(false);
            }}
            isDisabled={isSubmitting}
          >
            Huỷ
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Tạo dự án
          </Button>
        </div>
      </form>
    </Modal>
  );
}
