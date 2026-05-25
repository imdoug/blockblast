import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/theme";

export default function GameScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Game Screen</Text>
      <Text style={styles.sub}>Grid goes here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: "bold",
  },
  sub: {
    color: COLORS.textDim,
    fontSize: 16,
    marginTop: 8,
  },
});