import { StyleSheet, View } from 'react-native';
import type { Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import type { LegalDocument } from './legalContent';

/** Renders a legal document bundled with the app, so it reads offline and before sign-in. */
export function LegalDocumentScreen({ doc }: { doc: LegalDocument }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title={doc.title} back backFallback={'/about' as Href} />
      <View style={styles.page}>
        <Text variant="caption" color="muted">
          Last updated {doc.updated}
        </Text>
        {doc.intro.map((paragraph) => (
          <Text key={paragraph} color="secondary" style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text variant="subheading" accessibilityRole="header">
              {section.heading}
            </Text>
            {section.body?.map((paragraph) => (
              <Text key={paragraph} color="secondary" style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.bullets?.map((item) => (
              <View key={item} style={styles.bullet}>
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                <Text color="secondary" style={[styles.paragraph, styles.grow]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg, paddingVertical: spacing.lg },
  section: { gap: spacing.sm },
  paragraph: { lineHeight: 22 },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  grow: { flex: 1 },
});
