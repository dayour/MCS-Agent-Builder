import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore, type TerminalSession } from "@/stores/terminalStore";

interface XTerminalProps {
  session: TerminalSession;
  visible: boolean;
}

const XTerminal = ({ session, visible }: XTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const updateStatus = useTerminalStore((s) => s.updateSessionStatus);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    updateStatus(session.id, "connecting");
    const ws = new WebSocket(session.wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus(session.id, "running");
      termRef.current?.writeln(`\x1b[32m● Connected to ${session.wsUrl}\x1b[0m`);
      termRef.current?.writeln(`\x1b[90m── ${session.type.toUpperCase()}: ${session.agentName} ──\x1b[0m\n`);
    };

    ws.onmessage = (event) => {
      termRef.current?.write(event.data);
    };

    ws.onerror = () => {
      updateStatus(session.id, "error");
      termRef.current?.writeln(`\n\x1b[31m✖ Connection error\x1b[0m`);
    };

    ws.onclose = () => {
      updateStatus(session.id, "stopped");
      termRef.current?.writeln(`\n\x1b[33m● Disconnected\x1b[0m`);
      wsRef.current = null;
    };
  }, [session.id, session.wsUrl, session.type, session.agentName, updateStatus]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      lineHeight: 1.4,
      theme: {
        background: "#0a0e14",
        foreground: "#b3b1ad",
        cursor: "#e6b450",
        selectionBackground: "#253340",
        black: "#01060e",
        red: "#ea6c73",
        green: "#91b362",
        yellow: "#f9af4f",
        blue: "#53bdfa",
        magenta: "#fae994",
        cyan: "#90e1c6",
        white: "#c7c7c7",
        brightBlack: "#686868",
        brightRed: "#f07178",
        brightGreen: "#c2d94c",
        brightYellow: "#ffb454",
        brightBlue: "#59c2ff",
        brightMagenta: "#ffee99",
        brightCyan: "#95e6cb",
        brightWhite: "#ffffff",
      },
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    // Connect WebSocket
    connect();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [connect]);

  // Refit on visibility change
  useEffect(() => {
    if (visible && fitRef.current) {
      requestAnimationFrame(() => {
        try { fitRef.current?.fit(); } catch {}
      });
    }
  }, [visible]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (visible && fitRef.current) {
        try { fitRef.current.fit(); } catch {}
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: visible ? "block" : "none" }}
    />
  );
};

export default XTerminal;
