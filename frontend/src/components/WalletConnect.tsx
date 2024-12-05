import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletConnectProps {
  hasSession: boolean;
}

export function WalletConnect({ hasSession }: WalletConnectProps) {
  return (
    <div className="flex justify-end mb-4">
      <ConnectButton showBalance={hasSession} />
    </div>
  );
}
