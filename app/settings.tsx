import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Switch, Alert, ScrollView, Linking, Image, ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { COLORS } from "../src/constants/theme";
import {
  loadHapticsEnabled, saveHapticsEnabled,
  loadSoundEnabled, saveSoundEnabled,
  clearAllData,
} from "../src/store/storage";
import { setHapticsEnabled } from "../src/hooks/useHaptics";

const PhoneIcon = require("../assets/settings-icons/phone.png");
const SoundIcon = require("../assets/settings-icons/sound.png");
const TrashIcon = require("../assets/settings-icons/trash.png");
const StarIcon  = require("../assets/settings-icons/star.png");
const LockIcon  = require("../assets/settings-icons/lock.png");
const InfoIcon  = require("../assets/settings-icons/info.png");

const PRIVACY_URL = "https://imdoug.github.io/bloxburst-privacy/";
const VERSION = Constants.expoConfig?.version ?? "1.0.0";

// ─── Row components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function ToggleRow({
  icon, label, sublabel, value, onToggle, disabled,
}: {
  icon: ImageSourcePropType; label: string; sublabel?: string;
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[s.row, disabled && s.rowDisabled]}>
      <Image source={icon} style={s.rowIcon} />
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
  icon: ImageSourcePropType; label: string; sublabel?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Image source={icon} style={s.rowIcon} />
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      <Text style={s.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

function DangerRow({ icon, label, sublabel, onPress }: {
  icon: ImageSourcePropType; label: string; sublabel?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Image source={icon} style={s.rowIcon} />
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
  const [sound, setSound]     = useState(true);

  useEffect(() => {
    async function load() {
      const [h, so] = await Promise.all([loadHapticsEnabled(), loadSoundEnabled()]);
      setHaptics(h); setSound(so);
      setHapticsEnabled(h);
    }
    load();
  }, []);

  function toggleHaptics(v: boolean) {
    setHaptics(v); saveHapticsEnabled(v); setHapticsEnabled(v);
  }
  function toggleSound(v: boolean) {
    setSound(v); saveSoundEnabled(v);
  }

  function handleResetProgress() {
    Alert.alert(
      "Reset all progress?",
      "This will delete your level progress, stars, personal best, and streak. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything", style: "destructive",
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

  function handlePrivacyPolicy() { Linking.openURL(PRIVACY_URL); }

  function handleRateApp() {
    Alert.alert("Not published yet", "Rate us on the App Store once the app is live!", [{ text: "OK" }]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Image source={require("../assets/icons/arrow-left.png")} style={s.backArrow} />
          <Text style={s.back}>Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <SectionHeader title="Game Feel" />
        <View style={s.card}>
          <ToggleRow
            icon={PhoneIcon}
            label="Haptics"
            sublabel="Vibration feedback on piece placement and line clears"
            value={haptics}
            onToggle={toggleHaptics}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={SoundIcon}
            label="Sound effects"
            sublabel="Coming soon — wire in with the production build"
            value={sound}
            onToggle={toggleSound}
            disabled
          />
        </View>

        <SectionHeader title="Progress" />
        <View style={s.card}>
          <DangerRow
            icon={TrashIcon}
            label="Reset all progress"
            sublabel="Clears levels, stars, personal best, and streak"
            onPress={handleResetProgress}
          />
        </View>

        <SectionHeader title="About" />
        <View style={s.card}>
          <LinkRow
            icon={LockIcon}
            label="Privacy Policy"
            sublabel="How we handle your data"
            onPress={handlePrivacyPolicy}
          />
          <View style={s.divider} />
          <LinkRow
            icon={StarIcon}
            label="Rate BloxBurst"
            sublabel="Enjoying the game? Leave a review"
            onPress={handleRateApp}
          />
          <View style={s.divider} />
          <View style={s.row}>
            <Image source={InfoIcon} style={s.rowIcon} />
            <View style={s.rowText}>
              <Text style={s.rowLabel}>Version</Text>
              <Text style={s.rowSub}>BloxBurst v{VERSION}</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>Made with ❤️ · BloxBurst © 2026</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 6, width: 60 },
  backArrow: { width: 22, height: 16, resizeMode: "contain" },  
  container:     { flex: 1, backgroundColor: COLORS.background, paddingTop: 52 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 44, marginBottom: 8 },
  back:          { color: COLORS.textDim, fontSize: 16, width: 60, fontFamily: "FredokaOne_400Regular" },
  title:         { color: COLORS.text, fontSize: 18, fontWeight: "bold", textAlign: "center", fontFamily: "LuckiestGuy_400Regular" },
  content:       { paddingHorizontal: 16, paddingBottom: 48 },
  sectionHeader: { color: COLORS.textDim, fontSize: 11, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginTop: 24, marginBottom: 8, marginLeft: 4, fontFamily: "LuckiestGuy_400Regular" },
  card:          { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  row:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowDisabled:   { opacity: 0.45 },
  rowIcon:       { width: 22, height: 22, resizeMode: "contain" },
  rowText:       { flex: 1, gap: 2 },
  rowLabel:      { color: COLORS.text, fontSize: 15, fontFamily: "FredokaOne_400Regular" },
  dangerLabel:   { color: COLORS.danger, fontFamily: "FredokaOne_400Regular" },
  rowSub:        { color: COLORS.textDim, fontSize: 12, lineHeight: 16, fontFamily: "FredokaOne_400Regular" },
  rowArrow:      { color: COLORS.textDim, fontSize: 20, lineHeight: 22, fontFamily: "FredokaOne_400Regular" },
  divider:       { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginLeft: 50 },
  footer:        { color: COLORS.textDim, fontSize: 13, textAlign: "center", marginTop: 36, fontFamily: "FredokaOne_400Regular" },

});