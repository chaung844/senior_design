"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Settings01Icon,
    Delete02Icon,
    UserAdd01Icon,
    UserRemove01Icon,
    Alert02Icon,
    UserIcon,
    Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useUpdateAccount, useDeleteAccount } from "@/hooks/use-accounts";
import {
    useAccountMembers,
    useAddAccountMember,
    useRemoveAccountMember,
} from "@/hooks/use-account-members";
import { lookupUserByEmail } from "@/lib/api";
import type { AccountBookRead, MemberRead } from "@/lib/types";

// ── Member badge (primary owner = AccountBook.user_id) ────────────────

function MemberKindBadge({ isPrimary }: { isPrimary: boolean }) {
    return (
        <Badge
            variant={isPrimary ? "default" : "outline"}
            className="text-[10px] h-4 px-1.5"
        >
            {isPrimary ? "Owner" : "Member"}
        </Badge>
    );
}

// ── Remove member confirm ─────────────────────────────────────────────

function RemoveMemberButton({
    member,
    accountId,
    disabled,
}: {
    member: MemberRead;
    accountId: number;
    disabled?: boolean;
}) {
    const { mutate: removeMember, isPending } = useRemoveAccountMember();

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                    <HugeiconsIcon
                        icon={UserRemove01Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                    <span className="sr-only">Remove {member.user_name}</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogMedia>
                        <HugeiconsIcon
                            icon={UserRemove01Icon}
                            strokeWidth={1.5}
                        />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Remove member?</AlertDialogTitle>
                    <AlertDialogDescription>
                        <strong>{member.user_name}</strong> ({member.user_email}
                        ) will lose access to this account book.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() =>
                            removeMember({
                                accountId,
                                userId: member.user_id,
                            })
                        }
                    >
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Add member row ────────────────────────────────────────────────────

type AddStatus =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; name: string }
    | { kind: "error"; message: string };

function AddMemberRow({ accountId }: { accountId: number }) {
    const [email, setEmail] = React.useState("");
    const [status, setStatus] = React.useState<AddStatus>({ kind: "idle" });
    const { mutate: addMember } = useAddAccountMember();

    // Auto-clear success/error feedback after 4 s
    React.useEffect(() => {
        if (status.kind === "idle" || status.kind === "loading") return;
        const t = setTimeout(() => setStatus({ kind: "idle" }), 4000);
        return () => clearTimeout(t);
    }, [status]);

    async function handleAdd() {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;

        setStatus({ kind: "loading" });

        // Step 1: resolve email → user_id
        let userId: number;
        let userName: string;
        try {
            const user = await lookupUserByEmail(trimmed);
            userId = user.user_id;
            userName = user.name;
        } catch (err) {
            setStatus({
                kind: "error",
                message: err instanceof Error ? err.message : "User not found",
            });
            return;
        }

        // Step 2: add member
        addMember(
            { accountId, body: { user_id: userId } },
            {
                onSuccess: () => {
                    setStatus({ kind: "success", name: userName });
                    setEmail("");
                },
                onError: (err) => {
                    setStatus({
                        kind: "error",
                        message:
                            err instanceof Error
                                ? err.message
                                : "Failed to add user",
                    });
                },
            },
        );
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    }

    const isLoading = status.kind === "loading";

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-add-user">Add User by Email</Label>
            <div className="flex gap-2">
                <Input
                    id="edit-add-user"
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (status.kind !== "idle") setStatus({ kind: "idle" });
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="user@example.com"
                    disabled={isLoading}
                    className="flex-1"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAdd}
                    disabled={isLoading || !email.trim()}
                >
                    {isLoading ? (
                        <span
                            className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                            aria-hidden
                        />
                    ) : (
                        <HugeiconsIcon
                            icon={UserAdd01Icon}
                            strokeWidth={2}
                            className="size-3.5"
                        />
                    )}
                    {isLoading ? "Adding…" : "Add"}
                </Button>
            </div>

            {/* Feedback line */}
            {status.kind === "success" && (
                <p className="flex items-center gap-1 text-[11px] text-primary">
                    <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2.5}
                        className="size-3 shrink-0"
                    />
                    <strong>{status.name}</strong>&nbsp;added successfully.
                </p>
            )}
            {status.kind === "error" && (
                <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className="size-3 shrink-0"
                    />
                    {status.message}
                </p>
            )}
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────

interface EditAccountDialogProps {
    account: AccountBookRead;
}

// ── Main component ────────────────────────────────────────────────────

export function EditAccountDialog({ account }: EditAccountDialogProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    // ── Form state ────────────────────────────────────────────────────
    const [accountName, setAccountName] = React.useState(account.account_name);
    const [last4, setLast4] = React.useState(account.account_number_last4);
    const [currency, setCurrency] = React.useState(account.currency);

    // ── Mutations ─────────────────────────────────────────────────────
    const { mutate: updateAccount, isPending: isSaving } = useUpdateAccount();
    const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

    // ── Queries ───────────────────────────────────────────────────────
    const { data: membersData, isLoading: membersLoading } = useAccountMembers(
        open ? account.account_id : null,
    );

    const members = membersData?.members ?? [];

    // ── Sync form fields when dialog opens or account prop changes ────
    React.useEffect(() => {
        if (open) {
            setAccountName(account.account_name);
            setLast4(account.account_number_last4);
            setCurrency(account.currency);
        }
    }, [open, account]);

    // ── Handlers ──────────────────────────────────────────────────────
    function handleSave() {
        updateAccount(
            {
                accountId: account.account_id,
                body: {
                    account_name: accountName.trim() || undefined,
                    account_number_last4: last4.trim() || undefined,
                    currency: currency.trim() || undefined,
                },
            },
            { onSuccess: () => setOpen(false) },
        );
    }

    function handleDelete() {
        deleteAccount(account.account_id, {
            onSuccess: () => {
                setOpen(false);
                router.push("/dashboard");
            },
        });
    }

    // ── Derived ───────────────────────────────────────────────────────
    const isDirty =
        accountName.trim() !== account.account_name ||
        last4.trim() !== account.account_number_last4 ||
        currency.trim() !== account.currency;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <HugeiconsIcon
                        icon={Settings01Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                    Edit Account Book
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md flex flex-col gap-0 p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-3">
                    <DialogTitle>Edit Account Book</DialogTitle>
                    <DialogDescription>
                        Update account details and manage member access.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[70vh]">
                    <div className="flex flex-col gap-5 px-4 pb-4">
                        {/* ── Account Info ─────────────────────────── */}
                        <section className="flex flex-col gap-3">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Account Info
                            </h3>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-account-name">
                                    Account Name
                                </Label>
                                <Input
                                    id="edit-account-name"
                                    value={accountName}
                                    onChange={(e) =>
                                        setAccountName(e.target.value)
                                    }
                                    placeholder="e.g. Chase Sapphire"
                                    maxLength={100}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-last4">
                                        Last 4 Digits
                                    </Label>
                                    <Input
                                        id="edit-last4"
                                        value={last4}
                                        onChange={(e) => {
                                            const v = e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 4);
                                            setLast4(v);
                                        }}
                                        placeholder="1234"
                                        maxLength={4}
                                        className="font-mono"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-currency">
                                        Currency
                                    </Label>
                                    <Input
                                        id="edit-currency"
                                        value={currency}
                                        onChange={(e) =>
                                            setCurrency(
                                                e.target.value
                                                    .toUpperCase()
                                                    .slice(0, 3),
                                            )
                                        }
                                        placeholder="USD"
                                        maxLength={3}
                                        className="font-mono uppercase"
                                    />
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* ── Members ──────────────────────────────── */}
                        <section className="flex flex-col gap-3">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Members
                            </h3>

                            {/* Current member list */}
                            {membersLoading ? (
                                <div className="flex flex-col gap-1.5">
                                    {[1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="h-9 rounded-none bg-muted animate-pulse"
                                        />
                                    ))}
                                </div>
                            ) : members.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    No members yet.
                                </p>
                            ) : (
                                <div className="flex flex-col divide-y divide-border border border-border">
                                    {members.map((member) => {
                                        const isPrimaryOwner =
                                            member.user_id === account.user_id;
                                        return (
                                            <div
                                                key={member.id}
                                                className="flex items-center gap-2 px-2.5 py-2"
                                            >
                                                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                                    <HugeiconsIcon
                                                        icon={UserIcon}
                                                        strokeWidth={2}
                                                        className="size-3"
                                                    />
                                                </div>
                                                <div className="flex flex-1 min-w-0 flex-col">
                                                    <span className="truncate text-xs font-medium leading-none">
                                                        {member.user_name}
                                                    </span>
                                                    <span className="truncate text-[10px] text-muted-foreground mt-0.5">
                                                        {member.user_email}
                                                    </span>
                                                </div>
                                                <MemberKindBadge
                                                    isPrimary={isPrimaryOwner}
                                                />
                                                {!isPrimaryOwner && (
                                                    <RemoveMemberButton
                                                        member={member}
                                                        accountId={
                                                            account.account_id
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add member by email */}
                            <AddMemberRow accountId={account.account_id} />
                        </section>

                        <Separator />

                        {/* ── Danger Zone ───────────────────────────── */}
                        <section className="flex flex-col gap-3">
                            <h3 className="text-xs font-medium text-destructive uppercase tracking-wide">
                                Danger Zone
                            </h3>
                            <div className="flex items-center justify-between rounded-none border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                                <div>
                                    <p className="text-xs font-medium">
                                        Delete account book
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        This action is permanent and cannot be
                                        undone.
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={isDeleting}
                                        >
                                            <HugeiconsIcon
                                                icon={Delete02Icon}
                                                strokeWidth={2}
                                                className="size-3.5"
                                            />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent size="sm">
                                        <AlertDialogHeader>
                                            <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                                <HugeiconsIcon
                                                    icon={Delete02Icon}
                                                    strokeWidth={1.5}
                                                />
                                            </AlertDialogMedia>
                                            <AlertDialogTitle>
                                                Delete account book?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                <strong>
                                                    {account.account_name}
                                                </strong>{" "}
                                                and all its data will be
                                                permanently deleted. This cannot
                                                be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                variant="destructive"
                                                onClick={handleDelete}
                                            >
                                                {isDeleting
                                                    ? "Deleting…"
                                                    : "Delete"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <DialogFooter className="border-t border-border px-4 py-3">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                    >
                        {isSaving ? (
                            <span
                                className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                aria-hidden
                            />
                        ) : null}
                        {isSaving ? "Saving…" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
