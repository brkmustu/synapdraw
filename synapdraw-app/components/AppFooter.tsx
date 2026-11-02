import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";
import { LiveMcpBridge } from "./LiveMcpBridge";

interface AppFooterProps {
  onChange: () => void;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
  onOpenLiveMcpModal?: () => void;
}

export const AppFooter = React.memo(
  ({ onChange, excalidrawAPI, onOpenLiveMcpModal }: AppFooterProps) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
          <LiveMcpBridge
            excalidrawAPI={excalidrawAPI ?? null}
            onOpenModal={onOpenLiveMcpModal}
          />
        </div>
      </Footer>
    );
  },
);
