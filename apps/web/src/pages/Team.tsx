/**
 * Team.tsx — Team Member Management
 *
 * Features:
 * - Invite new members by email
 * - View all organization members
 * - Update member roles (OWNER, ADMIN, MEMBER, VIEWER)
 * - Remove members from organization
 * - Resend pending invitations
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../hooks/useTenant";
import { api, getErrorMessage } from "../lib/api";
import {
  Users,
  Mail,
  UserPlus,
  Loader2,
  Trash2,
  Shield,
  User,
  Eye,
  AlertCircle,
  Check,
  X,
  ChevronDown,
} from "lucide-react";

/* ─────────── Types ─────────── */

type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<MemberRole, { label: string; icon: typeof User; color: string }> = {
  OWNER: { label: "Owner", icon: Shield, color: "text-amber-600 bg-amber-50" },
  ADMIN: { label: "Admin", icon: Shield, color: "text-blue-600 bg-blue-50" },
  MEMBER: { label: "Member", icon: User, color: "text-slate-600 bg-slate-50" },
  VIEWER: { label: "Viewer", icon: Eye, color: "text-muted-foreground bg-muted" },
};

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
];

/* ─────────── Component ─────────── */

export function Team() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const tenantId = tenant?.id;

  /** Fetch team members */
  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["team", "members", tenantId],
    queryFn: async () => {
      const { data } = await api.get<Member[]>("/team/members");
      return data;
    },
    enabled: !!tenantId,
  });

  /** Fetch pending invitations */
  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ["team", "invitations", tenantId],
    queryFn: async () => {
      const { data } = await api.get<Invitation[]>("/team/invitations");
      return data;
    },
    enabled: !!tenantId,
  });

  /** Invite member mutation */
  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: MemberRole }) => {
      const { data } = await api.post<{ invitation: Invitation }>("/team/invite", payload);
      return data;
    },
    onSuccess: () => {
      setInviteEmail("");
      setSuccess("Invitation sent successfully.");
      queryClient.invalidateQueries({ queryKey: ["team", "invitations"] });
      setTimeout(() => setSuccess(null), 4000);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  /** Update role mutation */
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: MemberRole }) => {
      const { data } = await api.patch<{ member: Member }>(`/team/members/${memberId}/role`, {
        role,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", "members"] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  /** Remove member mutation */
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await api.delete(`/team/members/${memberId}`);
    },
    onSuccess: () => {
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["team", "members"] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your team, invite members, and control access levels.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button className="ml-auto underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-50 p-4 text-sm text-emerald-700">
          <Check className="h-5 w-5" />
          <p>{success}</p>
          <button className="ml-auto underline" onClick={() => setSuccess(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Invite Form */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Invite Member</h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-md border bg-background py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as MemberRole)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Send Invite
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({members.length})
          </h2>
        </div>
        {membersLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No members yet. Invite your team above.
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((member) => {
              const roleMeta = ROLE_LABELS[member.role];
              const RoleIcon = roleMeta.icon;
              return (
                <li key={member.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                  {/* Avatar */}
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name ?? member.email}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {(member.name ?? member.email).charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.name ?? "Unnamed User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleMeta.color}`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleMeta.label}
                    </span>
                  </div>

                  {/* Actions */}
                  {member.role !== "OWNER" && (
                    <div className="flex items-center gap-1">
                      {/* Role Change Dropdown */}
                      <select
                        value={member.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: e.target.value as MemberRole,
                          })
                        }
                        className="rounded border bg-transparent px-2 py-1 text-xs outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setMemberToRemove(member.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Pending Invitations</h2>
          </div>
          <ul className="divide-y">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Role: {ROLE_LABELS[inv.role].label} · Expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Remove Member</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to remove this member? They will lose all
              access to this organization.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate(memberToRemove)}
                disabled={removeMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {removeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
