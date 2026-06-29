/**
 * Settings.tsx — Organization & Profile Settings
 *
 * Features:
 * - Organization profile (name, slug, logo)
 * - Personal profile settings
 * - API key management (generate, revoke, list)
 * - Danger zone (delete organization)
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../hooks/useTenant";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import {
  Settings as SettingsIcon,
  Building2,
  User,
  Key,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  X,
} from "lucide-react";

/* ─────────── Types ─────────── */

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface OrgSettings {
  name: string;
  slug: string;
  logoUrl: string | null;
  billingEmail: string;
}

/* ─────────── Component ─────────── */

export function Settings() {
  const { tenant, switchTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"org" | "profile" | "api-keys">("org");

  // Org settings form state
  const [orgForm, setOrgForm] = useState<OrgSettings>({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    logoUrl: null,
    billingEmail: "",
  });

  // API key form state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read"]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const tenantId = tenant?.id;

  /** Fetch API keys */
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["settings", "api-keys", tenantId],
    queryFn: async () => {
      const { data } = await api.get<ApiKey[]>("/api-keys");
      return data;
    },
    enabled: !!tenantId && activeTab === "api-keys",
  });

  /** Update org settings */
  const updateOrgMutation = useMutation({
    mutationFn: async (payload: Partial<OrgSettings>) => {
      const { data } = await api.patch<{ organization: typeof tenant }>(
        "/settings/organization",
        payload
      );
      return data;
    },
    onSuccess: () => {
      setSuccess("Organization settings updated.");
      if (tenantId) switchTenant(tenantId);
      setTimeout(() => setSuccess(null), 4000);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  /** Generate API key */
  const generateKeyMutation = useMutation({
    mutationFn: async (payload: { name: string; scopes: string[] }) => {
      const { data } = await api.post<{ apiKey: ApiKey; fullKey: string }>("/api-keys", payload);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.fullKey);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  /** Revoke API key */
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/api-keys/${keyId}`);
    },
    onSuccess: () => {
      setRevokeKeyId(null);
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const tabs = [
    { id: "org" as const, label: "Organization", icon: Building2 },
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "api-keys" as const, label: "API Keys", icon: Key },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization and account settings.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5" />
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Organization Tab ─── */}
      {activeTab === "org" && (
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold">Organization Profile</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                value={orgForm.slug}
                onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used for URLs: https://app.example.com/{orgForm.slug}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Billing Email
              </label>
              <input
                type="email"
                value={orgForm.billingEmail}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, billingEmail: e.target.value })
                }
                placeholder="billing@company.com"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => updateOrgMutation.mutate(orgForm)}
              disabled={updateOrgMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-fit"
            >
              {updateOrgMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ─── Profile Tab ─── */}
      {activeTab === "profile" && (
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold">Personal Profile</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.name ?? "Unnamed User"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                Role: {user?.role?.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="grid gap-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Profile editing coming soon. Manage your account details through
              your authentication provider.
            </p>
          </div>
        </div>
      )}

      {/* ─── API Keys Tab ─── */}
      {activeTab === "api-keys" && (
        <div className="space-y-6">
          {/* Generate Key Form */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Generate API Key</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newKeyName.trim()) return;
                generateKeyMutation.mutate({
                  name: newKeyName.trim(),
                  scopes: newKeyScopes,
                });
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                placeholder="Key name (e.g., Production API)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <select
                multiple={false}
                value={newKeyScopes[0]}
                onChange={(e) => setNewKeyScopes([e.target.value])}
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="read">Read Only</option>
                <option value="write">Read & Write</option>
                <option value="admin">Full Access</option>
              </select>
              <button
                type="submit"
                disabled={generateKeyMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {generateKeyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate Key
              </button>
            </form>

            {/* Show newly generated key */}
            {generatedKey && (
              <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Copy your API key now!
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      It will not be shown again.
                    </p>
                  </div>
                  <button
                    onClick={() => setGeneratedKey(null)}
                    className="text-amber-600 hover:text-amber-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded bg-amber-100 px-3 py-2 text-sm font-mono break-all">
                    {showKey ? generatedKey : `${generatedKey.slice(0, 12)}...`}
                  </code>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="rounded p-2 text-amber-600 hover:bg-amber-100"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <CopyButton text={generatedKey} />
                </div>
              </div>
            )}
          </div>

          {/* API Keys List */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="h-5 w-5" />
                Active API Keys ({apiKeys.length})
              </h2>
            </div>
            {keysLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No API keys yet. Generate one above to get started.
              </div>
            ) : (
              <div className="divide-y">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.prefix}... · {key.scopes.join(", ")} ·{" "}
                        {key.lastUsedAt
                          ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                          : "Never used"}
                      </p>
                    </div>
                    <button
                      onClick={() => setRevokeKeyId(key.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Key Confirmation */}
      {revokeKeyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke API Key
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will immediately invalidate the API key. Any services using it
              will stop working.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setRevokeKeyId(null)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => revokeKeyMutation.mutate(revokeKeyId)}
                disabled={revokeKeyMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {revokeKeyMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small copy-to-clipboard button with feedback */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded p-2 text-amber-600 hover:bg-amber-100"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
