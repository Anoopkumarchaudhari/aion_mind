"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";

type DeleteConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteConfirm({ open, onOpenChange, onConfirm }: DeleteConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="alert-overlay" />
        <AlertDialog.Content className="alert-content">
          <AlertDialog.Title className="alert-title">Delete this chat?</AlertDialog.Title>
          <AlertDialog.Description className="alert-description">
            This cannot be undone.
          </AlertDialog.Description>
          <div className="alert-actions">
            <AlertDialog.Cancel className="alert-button" type="button">
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className="alert-button is-danger"
              type="button"
              onClick={onConfirm}
            >
              Delete
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
