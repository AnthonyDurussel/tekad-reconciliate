import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Center, Stack } from "@mantine/core";
import i18n from "i18next";

type State = { error: Error | null };

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Center p="xl">
        <Stack maw={520}>
          <Alert color="red" title={i18n.t("common.errorBoundary.title")}>
            {this.state.error.message}
          </Alert>
          <Button onClick={() => window.location.reload()}>
            {i18n.t("common.errorBoundary.reload")}
          </Button>
        </Stack>
      </Center>
    );
  }
}
