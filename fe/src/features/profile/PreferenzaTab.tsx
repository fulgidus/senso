import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/features/auth/AuthContext";
import { createProfileApi } from "@/lib/profile-api";
import { sealForSelf, unsealFromSelf } from "@/features/messages/crypto";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── TagInput ────────────────────────────────────────────────────────────────
function TagInput({
  items,
  onChange,
  placeholder,
  addButtonLabel,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addButtonLabel: string;
}) {
  const [input, setInput] = useState("");
  const isMobile = useIsMobile();
  const addChip = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed]);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-primary/60 hover:text-primary"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "," || (!isMobile && e.key === "Enter")) {
            e.preventDefault();
            addChip();
          }
        }}
      />
      {isMobile && (
        <button
          type="button"
          onClick={addChip}
          disabled={!input.trim()}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {addButtonLabel}
        </button>
      )}
    </div>
  );
}

// ── Sealed profile JSON shape ────────────────────────────────────────────────
type ContactEntry = { value: string; label?: string };
type ChatContact = { provider: string; username: string; additional?: string | null };
type SealedProfileData = {
  first_name?: string | null;
  last_name?: string | null;
  exact_dob?: string | null;
  emails?: ContactEntry[];
  phones?: ContactEntry[];
  chat_contacts?: ChatContact[];
};

const CHAT_PROVIDERS = [
  "telegram",
  "whatsapp",
  "signal",
  "instagram",
  "facebook",
  "other",
] as const;

function computeAgeBracket(dob: string): string {
  const birth = new Date(dob);
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age <= 16) return "14-16";
  if (age <= 18) return "17-18";
  if (age <= 20) return "19-20";
  if (age <= 25) return "21-25";
  if (age <= 30) return "26-30";
  if (age <= 35) return "31-35";
  if (age <= 40) return "36-40";
  if (age <= 50) return "41-50";
  if (age <= 60) return "51-60";
  return "61+";
}

// ── Main component ────────────────────────────────────────────────────────────
export function PreferenzaTab({ token }: { token: string }) {
  const { t } = useTranslation();
  const { user, cryptoKeys, onUnauthorized } = useAuthContext();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);

  // ── Unsealed: demographics ───────────────────────────────────────────────
  const [demographics, setDemographics] = useState<{
    age_bracket: string | null;
    gender_at_birth: string | null;
    elected_gender: string | null;
    household_size: number | null;
    has_dependents: boolean | null;
    employment_status: string | null;
    region_of_residence: string | null;
  } | null>(null);

  // ── Unsealed: preferences ────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>([]);
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [prefSaved, setPrefSaved] = useState(false);

  // ── Sealed: identity card ────────────────────────────────────────────────
  const [sealedData, setSealedData] = useState<SealedProfileData>({});
  const [sealedLoaded, setSealedLoaded] = useState(false);
  const [sealSaveState, setSealSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── Load all on mount ────────────────────────────────────────────────────
  useEffect(() => {
    void profileApi
      .getDemographics(token)
      .then(setDemographics)
      .catch(() => {});
    void profileApi
      .getProfile(token)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((p: any) => {
        setGoals(p.goals || []);
        setDos(p.dos || []);
        setDonts(p.donts || []);
      })
      .catch(() => {});
    if (cryptoKeys && user.publicKeyB64) {
      void profileApi
        .getSealedProfile(token)
        .then(({ ciphertext }) => {
          if (ciphertext && user.publicKeyB64) {
            const plain = unsealFromSelf(
              ciphertext,
              user.publicKeyB64,
              cryptoKeys.x25519PrivateKey,
            );
            if (plain) {
              try {
                setSealedData(JSON.parse(plain) as SealedProfileData);
              } catch {
                /* tampered */
              }
            }
          }
          setSealedLoaded(true);
        })
        .catch(() => setSealedLoaded(true));
    } else {
      setSealedLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Demographics PATCH helpers ───────────────────────────────────────────
  const patchDemo = useCallback(
    (update: Partial<typeof demographics>) => {
      if (!demographics) return;
      const merged = { ...demographics, ...update };
      setDemographics(merged as typeof demographics);
      void profileApi
        .patchDemographics(token, update as Parameters<typeof profileApi.patchDemographics>[1])
        .catch(() => {});
    },
    [demographics, token, profileApi],
  );

  // ── Preferences PATCH helper ─────────────────────────────────────────────
  const savePrefs = useCallback(
    (g: string[], d: string[], dn: string[]) => {
      void fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ goals: g, dos: d, donts: dn }),
      })
        .then(() => {
          setPrefSaved(true);
          setTimeout(() => setPrefSaved(false), 2000);
        })
        .catch(() => {});
    },
    [token],
  );

  // ── Sealed save ──────────────────────────────────────────────────────────
  const handleSealedSave = async () => {
    if (!cryptoKeys || !user.publicKeyB64) return;
    setSealSaveState("saving");
    try {
      const ciphertext = sealForSelf(JSON.stringify(sealedData), user.publicKeyB64);
      await profileApi.patchSealedProfile(token, ciphertext);
      // If DOB changed, push age_bracket to demographics
      if (sealedData.exact_dob) {
        const bracket = computeAgeBracket(sealedData.exact_dob);
        await profileApi.patchDemographics(token, { age_bracket: bracket });
        setDemographics((prev) => (prev ? { ...prev, age_bracket: bracket } : prev));
      }
      setSealSaveState("saved");
      setTimeout(() => setSealSaveState("idle"), 2000);
    } catch {
      setSealSaveState("error");
    }
  };

  const updateSealed = (patch: Partial<SealedProfileData>) =>
    setSealedData((prev) => ({ ...prev, ...patch }));

  const ITALIAN_REGIONS = [
    "Abruzzo",
    "Basilicata",
    "Calabria",
    "Campania",
    "Emilia-Romagna",
    "Friuli-Venezia Giulia",
    "Lazio",
    "Liguria",
    "Lombardia",
    "Marche",
    "Molise",
    "Piemonte",
    "Puglia",
    "Sardegna",
    "Sicilia",
    "Toscana",
    "Trentino-Alto Adige",
    "Umbria",
    "Valle d'Aosta",
    "Veneto",
  ];

  return (
    <div className="space-y-6">
      {/* ── Unsealed section ────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("profile.preferences.unsealedHeading")}</h2>
          <p className="text-xs text-muted-foreground ml-auto">
            {t("profile.preferences.unsealedHint")}
          </p>
        </div>

        {/* Demographics */}
        {demographics !== null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* age_bracket — read only, derived from DOB */}
            {demographics.age_bracket && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("profile.preferences.ageBracketLabel")}
                </label>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                  {demographics.age_bracket}
                </span>
              </div>
            )}
            {/* gender_at_birth */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.genderAtBirthLabel")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={demographics.gender_at_birth ?? ""}
                onChange={(e) => patchDemo({ gender_at_birth: e.target.value || null })}
              >
                <option value="">—</option>
                <option value="male">Maschio</option>
                <option value="female">Femmina</option>
                <option value="intersex">Intersex</option>
                <option value="prefer_not_to_say">Preferisco non rispondere</option>
              </select>
            </div>
            {/* elected_gender */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.electedGenderLabel")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={demographics.elected_gender ?? ""}
                onChange={(e) => patchDemo({ elected_gender: e.target.value || null })}
              >
                <option value="">—</option>
                <option value="uomo">Uomo</option>
                <option value="donna">Donna</option>
                <option value="non-binario">Non-binario</option>
                <option value="altro">Altro</option>
                <option value="prefer_not_to_say">Preferisco non rispondere</option>
              </select>
            </div>
            {/* household_size */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.householdSizeLabel")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={demographics.household_size ?? ""}
                onChange={(e) =>
                  patchDemo({ household_size: e.target.value ? parseInt(e.target.value) : null })
                }
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="9">9+</option>
              </select>
            </div>
            {/* has_dependents */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                {t("profile.preferences.hasDependentsLabel")}
              </label>
              <button
                type="button"
                onClick={() => patchDemo({ has_dependents: !demographics.has_dependents })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${demographics.has_dependents ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${demographics.has_dependents ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            {/* employment_status */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.employmentStatusLabel")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={demographics.employment_status ?? ""}
                onChange={(e) => patchDemo({ employment_status: e.target.value || null })}
              >
                <option value="">—</option>
                <option value="employed">Dipendente</option>
                <option value="self_employed">Autonomo / P.IVA</option>
                <option value="student">Studente</option>
                <option value="retired">Pensionato</option>
                <option value="unemployed">Disoccupato</option>
                <option value="other">Altro</option>
              </select>
            </div>
            {/* region_of_residence */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.regionLabel")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={demographics.region_of_residence ?? ""}
                onChange={(e) => patchDemo({ region_of_residence: e.target.value || null })}
              >
                <option value="">—</option>
                {ITALIAN_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Goals / Dos / Donts */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t("preferences.goalsLabel")}
            </label>
            <TagInput
              items={goals}
              onChange={(v) => {
                setGoals(v);
                savePrefs(v, dos, donts);
              }}
              placeholder={t("preferences.goalsPlaceholder")}
              addButtonLabel={t("preferences.addButton")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t("preferences.dosLabel")}
            </label>
            <TagInput
              items={dos}
              onChange={(v) => {
                setDos(v);
                savePrefs(goals, v, donts);
              }}
              placeholder={t("preferences.dosPlaceholder")}
              addButtonLabel={t("preferences.addButton")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t("preferences.dontsLabel")}
            </label>
            <TagInput
              items={donts}
              onChange={(v) => {
                setDonts(v);
                savePrefs(goals, dos, v);
              }}
              placeholder={t("preferences.dontsPlaceholder")}
              addButtonLabel={t("preferences.addButton")}
            />
          </div>
          {prefSaved && <span className="text-xs text-primary">{t("preferences.saved")}</span>}
        </div>
      </section>

      {/* ── Sealed section ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("profile.preferences.sealedHeading")}</h2>
          <p className="text-xs text-muted-foreground ml-auto">
            {t("profile.preferences.sealedHint")}
          </p>
        </div>

        {!cryptoKeys || !user.publicKeyB64 ? (
          <div className="rounded-lg border border-border bg-muted p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("profile.preferences.lockedHeading")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("profile.preferences.lockedBody")}
              </p>
            </div>
          </div>
        ) : sealedLoaded ? (
          <div className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t("profile.preferences.firstNameLabel")}
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={sealedData.first_name ?? ""}
                  onChange={(e) => updateSealed({ first_name: e.target.value || null })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t("profile.preferences.lastNameLabel")}
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={sealedData.last_name ?? ""}
                  onChange={(e) => updateSealed({ last_name: e.target.value || null })}
                />
              </div>
            </div>
            {/* DOB */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.dobLabel")}
              </label>
              <input
                type="date"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={sealedData.exact_dob ?? ""}
                onChange={(e) => updateSealed({ exact_dob: e.target.value || null })}
              />
              {sealedData.exact_dob && (
                <span className="ml-2 text-xs text-muted-foreground">
                  → {computeAgeBracket(sealedData.exact_dob)}
                </span>
              )}
            </div>
            {/* Emails */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.emailsLabel")}
              </label>
              {(sealedData.emails ?? []).map((e, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={e.value}
                    onChange={(ev) => {
                      const arr = [...(sealedData.emails ?? [])];
                      arr[i] = { ...arr[i], value: ev.target.value };
                      updateSealed({ emails: arr });
                    }}
                  />
                  <input
                    className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={e.label ?? ""}
                    placeholder={t("profile.preferences.labelPlaceholder")}
                    onChange={(ev) => {
                      const arr = [...(sealedData.emails ?? [])];
                      arr[i] = { ...arr[i], label: ev.target.value || undefined };
                      updateSealed({ emails: arr });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSealed({ emails: (sealedData.emails ?? []).filter((_, j) => j !== i) })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSealed({ emails: [...(sealedData.emails ?? []), { value: "" }] })
                }
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <Plus className="h-3 w-3" />
                {t("profile.preferences.addEmail")}
              </button>
            </div>
            {/* Phones */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.phonesLabel")}
              </label>
              {(sealedData.phones ?? []).map((p, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={p.value}
                    onChange={(ev) => {
                      const arr = [...(sealedData.phones ?? [])];
                      arr[i] = { ...arr[i], value: ev.target.value };
                      updateSealed({ phones: arr });
                    }}
                  />
                  <input
                    className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={p.label ?? ""}
                    placeholder={t("profile.preferences.labelPlaceholder")}
                    onChange={(ev) => {
                      const arr = [...(sealedData.phones ?? [])];
                      arr[i] = { ...arr[i], label: ev.target.value || undefined };
                      updateSealed({ phones: arr });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSealed({ phones: (sealedData.phones ?? []).filter((_, j) => j !== i) })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSealed({ phones: [...(sealedData.phones ?? []), { value: "" }] })
                }
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <Plus className="h-3 w-3" />
                {t("profile.preferences.addPhone")}
              </button>
            </div>
            {/* Chat contacts */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("profile.preferences.chatContactsLabel")}
              </label>
              {(sealedData.chat_contacts ?? []).map((c, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <select
                    className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={c.provider}
                    onChange={(ev) => {
                      const arr = [...(sealedData.chat_contacts ?? [])];
                      arr[i] = { ...arr[i], provider: ev.target.value };
                      updateSealed({ chat_contacts: arr });
                    }}
                  >
                    {CHAT_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={c.username}
                    placeholder="@username"
                    onChange={(ev) => {
                      const arr = [...(sealedData.chat_contacts ?? [])];
                      arr[i] = { ...arr[i], username: ev.target.value };
                      updateSealed({ chat_contacts: arr });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSealed({
                        chat_contacts: (sealedData.chat_contacts ?? []).filter((_, j) => j !== i),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSealed({
                    chat_contacts: [
                      ...(sealedData.chat_contacts ?? []),
                      { provider: "telegram", username: "" },
                    ],
                  })
                }
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <Plus className="h-3 w-3" />
                {t("profile.preferences.addChatContact")}
              </button>
            </div>
            {/* Save button */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Button
                variant="default"
                disabled={sealSaveState === "saving"}
                onClick={() => void handleSealedSave()}
              >
                {sealSaveState === "saving" ? "..." : t("profile.preferences.saveButton")}
              </Button>
              {sealSaveState === "saved" && (
                <span className="text-xs text-primary">
                  {t("profile.preferences.savedIndicator")}
                </span>
              )}
              {sealSaveState === "error" && (
                <span className="text-xs text-destructive">
                  {t("profile.preferences.saveError")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        )}
      </section>
    </div>
  );
}
