import { useState } from "react";
import { View, Text } from "react-native";
import { Action, Field, ui } from "./ProductUI";
import {
  validateRecipeLabor,
  type RecipeLaborSettings,
} from "../../shared/recipeLabor";
export default function RecipeLaborEditor({
  value,
  onSave,
}: {
  value: RecipeLaborSettings;
  onSave: (value: RecipeLaborSettings) => Promise<void>;
}) {
  const [form, setForm] = useState({
      servings: String(value.servings),
      prepMinutes: value.prepMinutes == null ? "" : String(value.prepMinutes),
      cookMinutes: value.cookMinutes == null ? "" : String(value.cookMinutes),
      laborMinutes:
        value.laborMinutes == null ? "" : String(value.laborMinutes),
      laborRate: value.laborRate == null ? "" : String(value.laborRate),
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const edit = (key: keyof typeof form, text: string) => {
    setForm((v) => ({ ...v, [key]: text }));
    setSaved(false);
  };
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      const number = (s: string) => (s.trim() === "" ? null : Number(s));
      const next: RecipeLaborSettings = {
        servings: number(form.servings) ?? 0,
        prepMinutes: number(form.prepMinutes),
        cookMinutes: number(form.cookMinutes),
        laborMinutes: number(form.laborMinutes),
        laborRate: number(form.laborRate),
      };
      validateRecipeLabor(next);
      await onSave(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={ui.card}>
      <Text style={ui.name}>Yield, time & labor</Text>
      <Text style={ui.hint}>
        Set the batch yield, then enter your actual hands-on labor. No wage is
        assumed.
      </Text>
      <Field
        label="Servings per batch"
        value={form.servings}
        onChangeText={(t) => edit("servings", t)}
        keyboardType="decimal-pad"
      />
      <Field
        label="Estimated prep time (minutes)"
        value={form.prepMinutes}
        onChangeText={(t) => edit("prepMinutes", t)}
        keyboardType="decimal-pad"
        placeholder="Not entered"
      />
      <Field
        label="Estimated cooking time (minutes)"
        value={form.cookMinutes}
        onChangeText={(t) => edit("cookMinutes", t)}
        keyboardType="decimal-pad"
        placeholder="Not entered"
      />
      <Field
        label="Hands-on labor (person-minutes per batch)"
        value={form.laborMinutes}
        onChangeText={(t) => edit("laborMinutes", t)}
        keyboardType="decimal-pad"
        placeholder="Not entered"
      />
      <Text style={ui.hint}>
        Add all workers’ active minutes: two people working 15 minutes = 30
        person-minutes. Include active cooking; exclude unattended cooking. Prep
        and cooking times above do not automatically add labor.
      </Text>
      <Field
        label="Labor rate ($ per person-hour)"
        value={form.laborRate}
        onChangeText={(t) => edit("laborRate", t)}
        keyboardType="decimal-pad"
        placeholder="Your wage or loaded labor rate"
      />
      <Text style={ui.hint}>
        For a loaded rate, include employer payroll costs and benefits. Blank
        labor stays unknown; enter 0 hands-on minutes only when there is no
        labor cost.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
      <Action
        title={busy ? "Saving…" : "Save yield & labor"}
        onPress={() => void save()}
        disabled={busy}
      />
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={ui.label}>
          Saved. Cost breakdown updated.
        </Text>
      ) : null}
    </View>
  );
}
