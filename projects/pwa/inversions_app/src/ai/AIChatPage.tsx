import React from "react";
import { GlobalChatDrawer } from "./GlobalChatDrawer";

export function AIChatPage() {
  return (
    <div style={{
      height: "calc(100vh - 4.5rem)",
      width: "100%",
      position: "relative",
      overflow: "hidden"
    }}>
      <GlobalChatDrawer
        isOpen={true}
        onClose={() => {}}
        isInline={true}
      />
    </div>
  );
}

export default AIChatPage;
