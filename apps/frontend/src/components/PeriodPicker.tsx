import { Button, Group, Menu } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconCalendar,
  IconCalendarCog,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  currentMonth,
  lastMonth,
  lastThreeMonths,
  type Period,
} from "@/utils/period";

const F = "YYYY-MM-DD";

/** Période : un intervalle libre et des périodes prédéfinies (semaine, mois, année). */
export default function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const { t } = useTranslation();
  const rangeInputRef = useRef<HTMLButtonElement>(null);
  // Sélection en cours : le premier clic (début) n'est pas encore une période.
  const [draft, setDraft] = useState<[string | null, string | null]>([
    value.from,
    value.to,
  ]);
  const [shown, setShown] = useState(`${value.from}|${value.to}`);
  if (shown !== `${value.from}|${value.to}`) {
    setShown(`${value.from}|${value.to}`);
    setDraft([value.from, value.to]);
  }
  const now = dayjs();
  const presets: { key: string; period: Period }[] = [
    {
      key: "thisWeek",
      period: { from: now.startOf("week").format(F), to: now.format(F) },
    },
    { key: "thisMonth", period: currentMonth() },
    { key: "lastMonth", period: lastMonth() },
    { key: "last3Months", period: lastThreeMonths() },
    {
      key: "thisYear",
      period: { from: now.startOf("year").format(F), to: now.format(F) },
    },
    {
      key: "last12Months",
      period: {
        from: now.subtract(12, "month").add(1, "day").format(F),
        to: now.format(F),
      },
    },
  ];
  const active = presets.find(
    (p) => p.period.from === value.from && p.period.to === value.to,
  );
  return (
    <Group gap={6} wrap="nowrap">
      <DatePickerInput
        ref={rangeInputRef}
        type="range"
        leftSection={<IconCalendar size={16} />}
        valueFormat="DD.MM.YYYY"
        value={draft}
        allowSingleDateInRange
        miw={230}
        aria-label={t("period.label")}
        onChange={([from, to]) => {
          setDraft([from, to]);
          if (from && to) onChange({ from, to });
        }}
        // Refermé à mi-sélection : on revient à la période en vigueur.
        popoverProps={{
          onClose: () => setDraft([value.from, value.to]),
        }}
      />
      <Menu position="bottom-end">
        <Menu.Target>
          <Button
            variant="default"
            rightSection={<IconChevronDown size={14} />}
            px="sm"
          >
            {active ? t(`period.${active.key}`) : t("period.custom")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("period.presets")}</Menu.Label>
          {presets.map((p) => (
            <Menu.Item
              key={p.key}
              onClick={() => onChange(p.period)}
              rightSection={
                p.key === active?.key ? <IconCheck size={14} /> : undefined
              }
            >
              {t(`period.${p.key}`)}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconCalendarCog size={14} />}
            rightSection={active ? undefined : <IconCheck size={14} />}
            // Le calendrier s'ouvre une fois le menu refermé.
            onClick={() => setTimeout(() => rangeInputRef.current?.click(), 0)}
          >
            {t("period.customPick")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
