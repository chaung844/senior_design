"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Add01Icon,
    Search01Icon,
    UserMultipleIcon,
    UserIcon,
    ShieldUserIcon,
    BookOpen01Icon,
    Tick02Icon,
    Alert02Icon,
    Delete02Icon,
    UserRemove01Icon,
    Analytics02Icon,
} from "@hugeicons/core-free-icons";
import { type ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/domain-types";
import type {
    UserRead,
    UserRole,
    AccountBookRead,
    AccountBookUpdate,
    AccountType,
    MemberRead,
} from "@/lib/types";

const DEFAULT_ARCHIVE_AFTER_MONTHS_ADMIN = 18;
import { lookupUserByEmail } from "@/lib/api";
import {
    useAdminUsers,
    useCreateAdminUser,
    useUpdateAdminUser,
    useDeactivateAdminUser,
} from "@/hooks/use-admin-users";
import {
    useProvisionedTenantAccounts,
    useUpdateAccount,
    useDeleteAccount,
} from "@/hooks/use-accounts";
import {
    useAccountMembers,
    useAddAccountMember,
    useRemoveAccountMember,
} from "@/hooks/use-account-members";

// ── Column definitions ───────────────────────────────────────────────

type RoleFilter = "all" | "admin" | "viewer";

function makeTenantColumns(): ColumnDef<UserRead, unknown>[] {
    return [
        {
            accessorKey: "is_active",
            header: "Status",
            size: 80,
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) =>
                row.original.is_active ? (
                    <Badge variant="default" className="text-[9px] h-5 px-1.5">
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
                            className="size-2.5 mr-0.5"
                        />
                        Active
                    </Badge>
                ) : (
                    <Badge
                        variant="outline"
                        className="text-[9px] h-5 px-1.5 text-muted-foreground"
                    >
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            strokeWidth={2}
                            className="size-2.5 mr-0.5"
                        />
                        Inactive
                    </Badge>
                ),
        },
        {
            accessorKey: "name",
            header: "Name",
            size: 160,
            enableHiding: false,
            cell: ({ row }) => (
                <span className="text-xs font-medium truncate block">
                    {row.original.name}
                </span>
            ),
        },
        {
            accessorKey: "email",
            header: "Email",
            size: 220,
            cell: ({ row }) => (
                <span className="text-xs font-mono text-muted-foreground truncate block">
                    {row.original.email}
                </span>
            ),
        },
        {
            accessorKey: "role",
            header: "Role",
            size: 90,
            enableSorting: false,
            cell: ({ row }) => (
                <Badge
                    variant={
                        row.original.role === "admin" ? "secondary" : "outline"
                    }
                    className="text-[9px] h-5 px-1.5 capitalize"
                >
                    {row.original.role}
                </Badge>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Created",
            size: 100,
            cell: ({ row }) => (
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {new Date(row.original.created_at).toLocaleDateString()}
                </span>
            ),
        },
    ];
}

function makeAccountBookColumns(): ColumnDef<AccountBookRead, unknown>[] {
    return [
        {
            accessorKey: "account_name",
            header: "Account Name",
            size: 160,
            enableHiding: false,
            cell: ({ row }) => (
                <span className="text-xs font-medium truncate block">
                    {row.original.account_name}
                </span>
            ),
        },
        {
            accessorKey: "bank_name",
            header: "Bank",
            size: 120,
            cell: ({ row }) => (
                <span className="text-xs truncate block">
                    {row.original.bank_name}
                </span>
            ),
        },
        {
            accessorKey: "account_number_last4",
            header: "Last 4",
            size: 70,
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-[11px] font-mono text-muted-foreground">
                    ••{row.original.account_number_last4}
                </span>
            ),
        },
        {
            accessorKey: "currency",
            header: "Currency",
            size: 70,
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 font-mono"
                >
                    {row.original.currency}
                </Badge>
            ),
        },
        {
            accessorKey: "account_type",
            header: "Type",
            size: 100,
            cell: ({ row }) => (
                <Badge
                    variant="secondary"
                    className="text-[9px] h-5 px-1.5 capitalize"
                >
                    {row.original.account_type === "credit_card"
                        ? "Credit Card"
                        : "Checking"}
                </Badge>
            ),
        },
        {
            accessorKey: "member_count",
            header: "Members",
            size: 80,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums text-xs">
                    {formatNumber(row.original.member_count)}
                </div>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Created",
            size: 100,
            cell: ({ row }) => (
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {new Date(row.original.created_at).toLocaleDateString()}
                </span>
            ),
        },
    ];
}

// ── Spinner helper ───────────────────────────────────────────────────

function Spinner() {
    return (
        <span
            className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden
        />
    );
}

// ── Add User Dialog ──────────────────────────────────────────────────

interface AddUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
    const createUser = useCreateAdminUser();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [role, setRole] = React.useState<UserRole>("admin");
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setName("");
            setEmail("");
            setPassword("");
            setRole("admin");
            setError(null);
        }
    }, [open]);

    const canSubmit =
        name.trim().length > 0 &&
        email.trim().length > 0 &&
        password.length >= 6;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit || createUser.isPending) return;
        setError(null);
        try {
            await createUser.mutateAsync({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                role,
            });
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create user",
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add new user</DialogTitle>
                    <DialogDescription>
                        Create a new tenant user under your developer account.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="add-name">Name</Label>
                        <Input
                            id="add-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                            autoComplete="off"
                            disabled={createUser.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="add-email">Email</Label>
                        <Input
                            id="add-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            autoComplete="off"
                            disabled={createUser.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="add-password">Password</Label>
                        <Input
                            id="add-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            autoComplete="new-password"
                            disabled={createUser.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Role</Label>
                        <Select
                            value={role}
                            onValueChange={(v) => setRole(v as UserRole)}
                            disabled={createUser.isPending}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {error && (
                        <div className="text-xs text-destructive" role="alert">
                            {error}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={createUser.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit || createUser.isPending}
                        >
                            {createUser.isPending && <Spinner />}
                            Create User
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit User Dialog ─────────────────────────────────────────────────

interface EditUserDialogProps {
    user: UserRead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
    const updateUser = useUpdateAdminUser();
    const deactivateUser = useDeactivateAdminUser();

    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [role, setRole] = React.useState<UserRole>("admin");
    const [newPassword, setNewPassword] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (user && open) {
            setName(user.name);
            setEmail(user.email);
            setRole(user.role);
            setNewPassword("");
            setError(null);
        }
    }, [user, open]);

    if (!user) return null;

    const hasChanges =
        name.trim() !== user.name ||
        email.trim().toLowerCase() !== user.email ||
        role !== user.role ||
        newPassword.length > 0;

    const canSubmit =
        hasChanges && name.trim().length > 0 && email.trim().length > 0;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!user || !canSubmit || updateUser.isPending) return;
        setError(null);
        try {
            const body: Record<string, string | boolean> = {};
            if (name.trim() !== user.name) body.name = name.trim();
            if (email.trim().toLowerCase() !== user.email)
                body.email = email.trim().toLowerCase();
            if (role !== user.role) body.role = role;
            if (newPassword.length > 0) body.new_password = newPassword;

            await updateUser.mutateAsync({
                userId: user.user_id,
                body,
            });
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update user",
            );
        }
    }

    async function handleDeactivate() {
        if (!user) return;
        try {
            await deactivateUser.mutateAsync(user.user_id);
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to deactivate user",
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit user</DialogTitle>
                    <DialogDescription>
                        Update account details for{" "}
                        <span className="font-medium text-foreground">
                            {user.name}
                        </span>
                        .
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={updateUser.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                            id="edit-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={updateUser.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Role</Label>
                        <Select
                            value={role}
                            onValueChange={(v) => setRole(v as UserRole)}
                            disabled={updateUser.isPending}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-password">
                            New password (optional)
                        </Label>
                        <Input
                            id="edit-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Leave blank to keep current"
                            autoComplete="new-password"
                            disabled={updateUser.isPending}
                        />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <span>
                            Status:{" "}
                            <span
                                className={cn(
                                    "font-medium",
                                    user.is_active
                                        ? "text-primary"
                                        : "text-destructive",
                                )}
                            >
                                {user.is_active ? "Active" : "Inactive"}
                            </span>
                        </span>
                    </div>

                    {user.is_active && (
                        <>
                            <Separator />
                            <section className="flex flex-col gap-3">
                                <h3 className="text-xs font-medium text-destructive uppercase tracking-wide">
                                    Danger Zone
                                </h3>
                                <div className="flex items-center justify-between rounded-none border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                                    <div>
                                        <p className="text-xs font-medium">
                                            Deactivate user
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            This action disables their access to
                                            the platform.
                                        </p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                disabled={
                                                    updateUser.isPending ||
                                                    deactivateUser.isPending
                                                }
                                            >
                                                <HugeiconsIcon
                                                    icon={Delete02Icon}
                                                    strokeWidth={2}
                                                    className="size-3.5"
                                                />
                                                Deactivate
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
                                                    Deactivate user?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    <strong>{user.name}</strong>{" "}
                                                    will lose access to the
                                                    platform. They will no
                                                    longer be able to log in.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    variant="destructive"
                                                    onClick={handleDeactivate}
                                                >
                                                    {deactivateUser.isPending
                                                        ? "Deactivating…"
                                                        : "Deactivate"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </section>
                        </>
                    )}

                    {error && (
                        <div className="text-xs text-destructive" role="alert">
                            {error}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={updateUser.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit || updateUser.isPending}
                        >
                            {updateUser.isPending && <Spinner />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

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

// ── Edit Account Book Dialog ─────────────────────────────────────────

interface EditAccountDialogProps {
    account: AccountBookRead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function EditAccountDialog({
    account,
    open,
    onOpenChange,
}: EditAccountDialogProps) {
    const updateAccount = useUpdateAccount();
    const deleteAccount = useDeleteAccount();
    const addMember = useAddAccountMember();
    const { data: membersData, isLoading: membersLoading } = useAccountMembers(
        open && account ? account.account_id : null,
    );

    const [accountName, setAccountName] = React.useState("");
    const [bankName, setBankName] = React.useState("");
    const [currency, setCurrency] = React.useState("");
    const [accountNumber, setAccountNumber] = React.useState("");
    const [accountType, setAccountType] =
        React.useState<AccountType>("credit_card");
    const [memberEmail, setMemberEmail] = React.useState("");
    const [memberError, setMemberError] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (account && open) {
            setAccountName(account.account_name);
            setBankName(account.bank_name);
            setCurrency(account.currency);
            setAccountNumber(account.account_number_last4);
            setAccountType(account.account_type);
            setMemberEmail("");
            setMemberError(null);
            setError(null);
        }
    }, [account, open]);

    if (!account) return null;

    const members: MemberRead[] = membersData?.members ?? [];

    const displayArchiveAfterMonths =
        account.archive_after_months ?? DEFAULT_ARCHIVE_AFTER_MONTHS_ADMIN;

    const hasChanges =
        accountName.trim() !== account.account_name ||
        bankName.trim() !== account.bank_name ||
        currency.trim().toUpperCase() !== account.currency ||
        accountNumber.trim() !== account.account_number_last4 ||
        accountType !== account.account_type;

    const canSubmit =
        hasChanges &&
        accountName.trim().length > 0 &&
        bankName.trim().length > 0 &&
        currency.trim().length > 0 &&
        accountNumber.trim().length === 4;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!account || !canSubmit || updateAccount.isPending) return;
        setError(null);
        try {
            const body: AccountBookUpdate = {};
            if (accountName.trim() !== account.account_name)
                body.account_name = accountName.trim();
            if (bankName.trim() !== account.bank_name)
                body.bank_name = bankName.trim();
            if (currency.trim().toUpperCase() !== account.currency)
                body.currency = currency.trim().toUpperCase();
            if (accountNumber.trim() !== account.account_number_last4)
                body.account_number_last4 = accountNumber.trim();
            if (accountType !== account.account_type)
                body.account_type = accountType;

            await updateAccount.mutateAsync({
                accountId: account.account_id,
                body,
            });
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update account",
            );
        }
    }

    async function handleAddMember() {
        if (!account || !memberEmail.trim()) return;
        setMemberError(null);
        try {
            const found = await lookupUserByEmail(
                memberEmail.trim().toLowerCase(),
            );
            await addMember.mutateAsync({
                accountId: account.account_id,
                body: { user_id: found.user_id },
            });
            setMemberEmail("");
        } catch (err) {
            setMemberError(
                err instanceof Error ? err.message : "Failed to add member",
            );
        }
    }

    async function handleDelete() {
        if (!account) return;
        try {
            await deleteAccount.mutateAsync(account.account_id);
            onOpenChange(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete account",
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit account book</DialogTitle>
                    <DialogDescription>
                        Update details and manage membership for{" "}
                        <span className="font-medium text-foreground">
                            {account.account_name}
                        </span>
                        .
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-account-name">Account name</Label>
                        <Input
                            id="edit-account-name"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            disabled={updateAccount.isPending}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-bank-name">Bank name</Label>
                        <Input
                            id="edit-bank-name"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            disabled={updateAccount.isPending}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-currency">Currency</Label>
                            <Input
                                id="edit-currency"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                disabled={updateAccount.isPending}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-last4">Last 4 digits</Label>
                            <Input
                                id="edit-last4"
                                inputMode="numeric"
                                maxLength={4}
                                value={accountNumber}
                                onChange={(e) =>
                                    setAccountNumber(
                                        e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 4),
                                    )
                                }
                                disabled={updateAccount.isPending}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Account type</Label>
                        <Select
                            value={accountType}
                            onValueChange={(v) =>
                                setAccountType(v as AccountType)
                            }
                            disabled={updateAccount.isPending}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit_card">
                                    Credit Card
                                </SelectItem>
                                <SelectItem value="checking">
                                    Checking
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label id="edit-archive-months-admin-label">
                            Archive statements after (months)
                        </Label>
                        <div
                            className="flex h-9 items-center rounded-none border border-input bg-muted/50 px-3 font-mono text-sm tabular-nums"
                            aria-labelledby="edit-archive-months-admin-label"
                        >
                            {displayArchiveAfterMonths}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Set at account creation only; cannot be changed
                            after.
                        </p>
                    </div>

                    {error && (
                        <div className="text-xs text-destructive" role="alert">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={updateAccount.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit || updateAccount.isPending}
                        >
                            {updateAccount.isPending && <Spinner />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>

                <Separator />

                {/* Members section */}
                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Members
                    </h3>

                    <div className="flex items-center gap-2">
                        <Input
                            value={memberEmail}
                            onChange={(e) => setMemberEmail(e.target.value)}
                            placeholder="User email to add..."
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddMember();
                                }
                            }}
                        />
                        <Button
                            type="button"
                            size="sm"
                            disabled={
                                !memberEmail.trim() || addMember.isPending
                            }
                            onClick={handleAddMember}
                        >
                            {addMember.isPending ? (
                                <Spinner />
                            ) : (
                                <HugeiconsIcon
                                    icon={Add01Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                            )}
                            Add
                        </Button>
                    </div>

                    {memberError && (
                        <div className="text-xs text-destructive" role="alert">
                            {memberError}
                        </div>
                    )}

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
                            {members.map((m) => {
                                const isPrimaryOwner =
                                    m.user_id === account.user_id;
                                return (
                                    <div
                                        key={m.id}
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
                                                {m.user_name}
                                            </span>
                                            <span className="truncate text-[10px] text-muted-foreground mt-0.5">
                                                {m.user_email}
                                            </span>
                                        </div>
                                        <MemberKindBadge
                                            isPrimary={isPrimaryOwner}
                                        />
                                        {!isPrimaryOwner && (
                                            <RemoveMemberButton
                                                member={m}
                                                accountId={account.account_id}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <Separator />

                {/* Danger zone — mirrors edit-account-dialog */}
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
                                This action is permanent and cannot be undone.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteAccount.isPending}
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
                                        <strong>{account.account_name}</strong>{" "}
                                        and all its data will be permanently
                                        deleted. This cannot be undone.
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
                                        {deleteAccount.isPending
                                            ? "Deleting…"
                                            : "Delete"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </section>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Panel ───────────────────────────────────────────────────────

export function DeveloperGlobalAdminPanel() {
    const { data: usersData, isLoading: usersLoading } = useAdminUsers({
        provisioned_by_me: true,
        limit: 100,
    });
    const { data: accountsData, isLoading: accountsLoading } =
        useProvisionedTenantAccounts();

    const [activeTab, setActiveTab] = React.useState("tenants");
    const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("all");
    const [tenantSearch, setTenantSearch] = React.useState("");
    const [accountSearch, setAccountSearch] = React.useState("");

    const [addUserOpen, setAddUserOpen] = React.useState(false);
    const [editUser, setEditUser] = React.useState<UserRead | null>(null);
    const [editUserOpen, setEditUserOpen] = React.useState(false);
    const [editAccount, setEditAccount] =
        React.useState<AccountBookRead | null>(null);
    const [editAccountOpen, setEditAccountOpen] = React.useState(false);

    const allUsers = usersData?.users ?? [];
    const allAccounts = accountsData?.accounts ?? [];

    // ── Derived stats ────────────────────────────────────────────────

    const stats = React.useMemo(() => {
        const active = allUsers.filter((u) => u.is_active).length;
        const inactive = allUsers.length - active;
        const admins = allUsers.filter((u) => u.role === "admin").length;
        const viewers = allUsers.filter((u) => u.role === "viewer").length;
        const totalMembers = allAccounts.reduce(
            (sum, a) => sum + a.member_count,
            0,
        );
        const activeRate =
            allUsers.length > 0
                ? Math.round((active / allUsers.length) * 100)
                : 0;
        return { active, inactive, admins, viewers, totalMembers, activeRate };
    }, [allUsers, allAccounts]);

    // ── Filtered data ────────────────────────────────────────────────

    const filteredUsers = React.useMemo(() => {
        let list = allUsers;
        if (roleFilter !== "all") {
            list = list.filter((u) => u.role === roleFilter);
        }
        if (tenantSearch.trim()) {
            const q = tenantSearch.trim().toLowerCase();
            list = list.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q),
            );
        }
        return list;
    }, [allUsers, roleFilter, tenantSearch]);

    const filteredAccounts = React.useMemo(() => {
        if (!accountSearch.trim()) return allAccounts;
        const q = accountSearch.trim().toLowerCase();
        return allAccounts.filter(
            (a) =>
                a.account_name.toLowerCase().includes(q) ||
                a.bank_name.toLowerCase().includes(q) ||
                a.account_number_last4.includes(q),
        );
    }, [allAccounts, accountSearch]);

    // ── Column defs (stable) ─────────────────────────────────────────

    const tenantColumns = React.useMemo(() => makeTenantColumns(), []);
    const accountColumns = React.useMemo(() => makeAccountBookColumns(), []);

    // ── Toolbars ─────────────────────────────────────────────────────

    const tenantsToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="text-sm font-medium">Provisioned Users</h3>
                <p className="text-xs text-muted-foreground">
                    {filteredUsers.length === allUsers.length
                        ? `Showing all ${formatNumber(allUsers.length)} users`
                        : `Showing ${formatNumber(filteredUsers.length)} of ${formatNumber(allUsers.length)} users`}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {columnToggle}
                <div className="relative">
                    <HugeiconsIcon
                        icon={Search01Icon}
                        strokeWidth={2}
                        className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={tenantSearch}
                        onChange={(e) => setTenantSearch(e.target.value)}
                        className="h-7 w-50 rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    />
                </div>
                <div className="flex items-center border border-input rounded-none">
                    <Button
                        variant={roleFilter === "all" ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setRoleFilter("all")}
                        className="rounded-none border-0"
                    >
                        All
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant={roleFilter === "admin" ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setRoleFilter("admin")}
                        className="rounded-none border-0"
                    >
                        <HugeiconsIcon
                            icon={ShieldUserIcon}
                            strokeWidth={2}
                            className="size-3 mr-0.5"
                        />
                        Admin
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant={
                            roleFilter === "viewer" ? "secondary" : "ghost"
                        }
                        size="xs"
                        onClick={() => setRoleFilter("viewer")}
                        className="rounded-none border-0"
                    >
                        <HugeiconsIcon
                            icon={UserIcon}
                            strokeWidth={2}
                            className="size-3 mr-0.5"
                        />
                        Viewer
                    </Button>
                </div>
            </div>
        </div>
    );

    const accountsToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="text-sm font-medium">Account Books</h3>
                <p className="text-xs text-muted-foreground">
                    {filteredAccounts.length === allAccounts.length
                        ? `Showing all ${formatNumber(allAccounts.length)} account books`
                        : `Showing ${formatNumber(filteredAccounts.length)} of ${formatNumber(allAccounts.length)} account books`}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {columnToggle}
                <div className="relative">
                    <HugeiconsIcon
                        icon={Search01Icon}
                        strokeWidth={2}
                        className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="Search accounts..."
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        className="h-7 w-50 rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    />
                </div>
            </div>
        </div>
    );

    // ── Loading state ────────────────────────────────────────────────

    if (usersLoading || accountsLoading) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                        Tenant Management
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Manage provisioned users and their account books
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={() => setAddUserOpen(true)}
                    className="gap-1.5"
                >
                    <HugeiconsIcon
                        icon={Add01Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                    Add User
                </Button>
            </div>

            {/* Stat cards */}
            <div className="shrink-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={UserMultipleIcon}
                    label="Total Tenants"
                    value={formatNumber(allUsers.length)}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="text-primary">
                            {formatNumber(stats.active)} active
                        </span>
                        <span>·</span>
                        <span
                            className={
                                stats.inactive > 0
                                    ? "text-destructive"
                                    : undefined
                            }
                        >
                            {formatNumber(stats.inactive)} inactive
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={ShieldUserIcon}
                    label="Role Distribution"
                    value={`${formatNumber(stats.admins)} / ${formatNumber(stats.viewers)}`}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatNumber(stats.admins)} admins</span>
                        <span>·</span>
                        <span>{formatNumber(stats.viewers)} viewers</span>
                    </div>
                </StatCard>

                <StatCard
                    icon={BookOpen01Icon}
                    label="Account Books"
                    value={formatNumber(allAccounts.length)}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                            {formatNumber(stats.totalMembers)} total member
                            {stats.totalMembers !== 1 ? "s" : ""}
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={Analytics02Icon}
                    label="Active Rate"
                    value={`${stats.activeRate}%`}
                >
                    <div className="flex flex-col gap-1.5">
                        <Progress value={stats.activeRate} className="h-1.5" />
                        <div className="text-[11px] text-muted-foreground">
                            {stats.activeRate === 100
                                ? "All users active"
                                : `${formatNumber(stats.inactive)} user${stats.inactive !== 1 ? "s" : ""} inactive`}
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Tabbed tables */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col"
            >
                <TabsList variant="line" className="shrink-0">
                    <TabsTrigger value="tenants">
                        Tenants ({formatNumber(allUsers.length)})
                    </TabsTrigger>
                    <TabsTrigger value="accounts">
                        Account Books ({formatNumber(allAccounts.length)})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tenants" className="flex flex-col mt-3">
                    <DataTable
                        columns={tenantColumns}
                        data={filteredUsers}
                        toolbar={tenantsToolbar}
                        emptyMessage="No users found."
                        globalFilter={tenantSearch}
                        onGlobalFilterChange={setTenantSearch}
                        getRowId={(row) => String(row.user_id)}
                        onRowClick={(row) => {
                            setEditUser(row);
                            setEditUserOpen(true);
                        }}
                    />
                </TabsContent>

                <TabsContent value="accounts" className="flex flex-col mt-3">
                    <DataTable
                        columns={accountColumns}
                        data={filteredAccounts}
                        toolbar={accountsToolbar}
                        emptyMessage="No account books found."
                        globalFilter={accountSearch}
                        onGlobalFilterChange={setAccountSearch}
                        getRowId={(row) => String(row.account_id)}
                        onRowClick={(row) => {
                            setEditAccount(row);
                            setEditAccountOpen(true);
                        }}
                    />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} />
            <EditUserDialog
                user={editUser}
                open={editUserOpen}
                onOpenChange={(open) => {
                    setEditUserOpen(open);
                    if (!open) setEditUser(null);
                }}
            />
            <EditAccountDialog
                account={editAccount}
                open={editAccountOpen}
                onOpenChange={(open) => {
                    setEditAccountOpen(open);
                    if (!open) setEditAccount(null);
                }}
            />
        </div>
    );
}
