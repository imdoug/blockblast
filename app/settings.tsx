// app/settings.tsx

import {
  View, Text, StyleSheet, TouchableOpacity,
  Switch, Alert, ScrollView, Linking,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import Constants from "expo-constants";
import { COLORS } from "../src/constants/theme";
import {
  loadHapticsEnabled, saveHapticsEnabled,
  loadSoundEnabled, saveSoundEnabled,
  clearAllData,
} from "../src/store/storage";
import { setHapticsEnabled } from "../src/hooks/useHaptics";

const PRIVACY_URL = "https://imdoug.github.io/bloxburst-privacy/";
const VERSION = Constants.expoConfig?.version ?? "1.0.0";

// ─── Row components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function ToggleRow({
  icon, label, sublabel, value, onToggle, disabled,
}: {
  icon: string; label: string; sublabel?: string;
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[s.row, disabled && s.rowDisabled]}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: "rgba(255,255,255,0.1)", true: COLORS.primary }}
        thumbColor={value ? "#FFFFFF" : "rgba(255,255,255,0.6)"}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

function LinkRow({ icon, label, sublabel, onPress }: {
  icon: string; label: string; sublabel?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      <Text style={s.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

function DangerRow({ icon, label, sublabel, onPress }: {
  icon: string; label: string; sublabel?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.row, s.dangerRow]} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, s.dangerLabel]}>{label}</Text>
        {sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    async function load() {
      const [h, so] = await Promise.all([
        loadHapticsEnabled(),
        loadSoundEnabled(),
      ]);
      setHaptics(h);
      setSound(so);
      // Sync module-level haptics flag
      setHapticsEnabled(h);
    }
    load();
  }, []);

  function toggleHaptics(v: boolean) {
    setHaptics(v);
    saveHapticsEnabled(v);
    setHapticsEnabled(v); // instant effect across all screens
  }

  function toggleSound(v: boolean) {
    setSound(v);
    saveSoundEnabled(v);
  }

  function handleResetProgress() {
    Alert.alert(
      "Reset all progress?",
      "This will delete your level progress, stars, personal best, and streak. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Alert.alert(
              "Progress reset",
              "All data has been cleared. The app will feel like a fresh install.",
              [{ text: "OK", onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  }

  function handlePrivacyPolicy() {
    Linking.openURL(PRIVACY_URL);
  }

  function handleRateApp() {
    // Replace with your real App Store ID once published
    // Format: https://apps.apple.com/app/idXXXXXXXXX?action=write-review
    Alert.alert(
      "Not published yet",
      "Rate us on the App Store once the app is live!",
      [{ text: "OK" }]
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Game feel */}
        <SectionHeader title="Game Feel" />
        <View style={s.card}>
          <ToggleRow
            icon="📳"
            label="Haptics"
            sublabel="Vibration feedback on piece placement and line clears"
            value={haptics}
            onToggle={toggleHaptics}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="🔊"
            label="Sound effects"
            sublabel="Coming soon — wire in with the production build"
            value={sound}
            onToggle={toggleSound}
            disabled
          />
        </View>

        {/* Progress */}
        <SectionHeader title="Progress" />
        <View style={s.card}>
          <DangerRow
            icon="🗑️"
            label="Reset all progress"
            sublabel="Clears levels, stars, personal best, and streak"
            onPress={handleResetProgress}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={s.card}>
          <LinkRow
            icon="🔒"
            label="Privacy Policy"
            sublabel="How we handle your data"
            onPress={handlePrivacyPolicy}
          />
          <View style={s.divider} />
          <LinkRow
            icon="⭐"
            label="Rate BloxBurst"
            sublabel="Enjoying the game? Leave a review"
            onPress={handleRateApp}
          />
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowIcon}>ℹ️</Text>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>Version</Text>
              <Text style={s.rowSub}>BloxBurst v{VERSION}</Text>
            </View>
          </View>
        </View>

        {/* Made with love */}
        <Text style={s.footer}>
          Made with ❤️ · BloxBurst © 2026
        </Text>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 52,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 44,
    marginBottom: 8,
  },
  back: { color: COLORS.textDim, fontSize: 16, width: 60 },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDisabled: { opacity: 0.45 },
  dangerRow: { },
  rowIcon: { fontSize: 20, width: 28, textAlign: "center" },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: COLORS.text, fontSize: 15 },
  dangerLabel: { color: COLORS.danger },
  rowSub: { color: COLORS.textDim, fontSize: 12, lineHeight: 16 },
  rowArrow: { color: COLORS.textDim, fontSize: 20, lineHeight: 22 },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 56,
  },
  footer: {
    color: COLORS.textDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 36,
  },
});