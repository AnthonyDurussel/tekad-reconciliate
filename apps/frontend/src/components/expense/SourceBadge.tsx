import { Badge, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { SuggestionSourceDTO } from "@repo/models";

const COLOR: Record<SuggestionSourceDTO, string> = {
  [SuggestionSourceDTO.CARD]: "indigo",
  [SuggestionSourceDTO.TRANSACTION]: "cyan",
  [SuggestionSourceDTO.RULE]: "grape",
  [SuggestionSourceDTO.AI]: "violet",
  [SuggestionSourceDTO.MANUAL]: "gray",
};

/** D'où vient une valeur proposée : carte, transaction, règle, IA, saisie. */
export default function SourceBadge({
  source,
}: {
  source: SuggestionSourceDTO | null | undefined;
}) {
  const { t } = useTranslation();
  if (!source) return null;
  return (
    <Tooltip label={t(`enum.suggestionSourceHint.${source}`)} multiline w={240}>
      <Badge size="xs" variant="light" color={COLOR[source]}>
        {t(`enum.suggestionSource.${source}`)}
      </Badge>
    </Tooltip>
  );
}
