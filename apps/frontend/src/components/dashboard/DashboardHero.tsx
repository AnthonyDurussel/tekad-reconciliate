import type { ReactNode } from "react";
import { Grid, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { RingGauge } from "./charts";
import classes from "./dashboard.module.css";

export interface HeroStatItem {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export interface HeroGaugeItem {
  key: string;
  label: string;
  /** Fraction de 1 ; `null` : rien à mesurer, l'anneau reste vide. */
  value: number | null;
  display: string;
  /** Teinte (hex) de l'anneau. */
  color: string;
  hint?: ReactNode;
}

/**
 * Le bandeau d'ouverture d'un tableau de bord (repris de stoll) : une phrase
 * qui dit l'essentiel, quelques chiffres sur verre, et des taux en anneaux.
 * Fond noir de la navigation, accent vert TekAD.
 */
export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  stats = [],
  gauges = [],
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  stats?: HeroStatItem[];
  gauges?: HeroGaugeItem[];
  children?: ReactNode;
}) {
  const withGauges = gauges.length > 0;
  return (
    <div
      className={classes.hero}
      style={{
        ["--hero-bg" as string]: "#15191b",
        ["--hero-accent" as string]: "#16db65",
      }}
    >
      <Grid p={{ base: "lg", md: "xl" }} gap="xl" align="center" pos="relative">
        <Grid.Col span={{ base: 12, lg: withGauges ? 7 : 12 }}>
          <Stack gap="md">
            <div>
              <Text className={classes.heroEyebrow}>{eyebrow}</Text>
              <Text className={classes.heroTitle} mt={6}>
                {title}
              </Text>
              {subtitle && (
                <Text size="sm" className={classes.heroMuted} mt={6}>
                  {subtitle}
                </Text>
              )}
            </div>
            {stats.length > 0 && (
              <SimpleGrid
                cols={{ base: 2, sm: Math.min(stats.length, 4) }}
                spacing="sm"
              >
                {stats.map((stat) => (
                  <div key={stat.key} className={classes.heroStat}>
                    <Text
                      size="xs"
                      className={classes.heroMuted}
                      fw={600}
                      tt="uppercase"
                    >
                      {stat.label}
                    </Text>
                    <div className={classes.heroStatValue}>{stat.value}</div>
                    {stat.hint && (
                      <Text size="xs" className={classes.heroMuted}>
                        {stat.hint}
                      </Text>
                    )}
                  </div>
                ))}
              </SimpleGrid>
            )}
            {children}
          </Stack>
        </Grid.Col>
        {withGauges && (
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Group justify="space-around" gap="xs" wrap="nowrap">
              {gauges.map((gauge) => (
                <RingGauge
                  key={gauge.key}
                  size={112}
                  value={gauge.value}
                  display={gauge.display}
                  color={gauge.color}
                  track="rgba(255,255,255,0.08)"
                  label={
                    <Stack gap={0} align="center">
                      <Text
                        size="xs"
                        fw={700}
                        tt="uppercase"
                        lts={0.5}
                        c="#e3f1ef"
                        ta="center"
                      >
                        {gauge.label}
                      </Text>
                      {gauge.hint && (
                        <Text
                          size="xs"
                          className={classes.heroMuted}
                          ta="center"
                        >
                          {gauge.hint}
                        </Text>
                      )}
                    </Stack>
                  }
                />
              ))}
            </Group>
          </Grid.Col>
        )}
      </Grid>
    </div>
  );
}
