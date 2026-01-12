import { type Plugin } from "@opencode-ai/plugin"

export const ChimePlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      // session.idle is the only event we care about for "completion"
      if (event.type === "session.idle") {
        // This PowerShell command plays two distinct beeps
        // 800Hz for 100ms, then 1000Hz for 100ms
        await $`powershell.exe -c "[console]::beep(800, 100); [console]::beep(1000, 100)"`
          .quiet()
          .nothrow();
      }
    },
  };
};
