import dayjs from "dayjs";

export interface Period {
  from: string;
  to: string;
}

/** Du 1er du mois à aujourd'hui. */
export function currentMonth(): Period {
  return {
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  };
}

/** Le mois civil précédent, du 1er au dernier jour. */
export function lastMonth(): Period {
  const previous = dayjs().subtract(1, "month");
  return {
    from: previous.startOf("month").format("YYYY-MM-DD"),
    to: previous.endOf("month").format("YYYY-MM-DD"),
  };
}

/** Les trois derniers mois, du 1er du mois d'il y a deux mois à aujourd'hui. */
export function lastThreeMonths(): Period {
  return {
    from: dayjs().subtract(2, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  };
}
