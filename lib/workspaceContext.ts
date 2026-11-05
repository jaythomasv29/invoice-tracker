import { createContext, useContext } from 'react';
import type { AccountType } from '../shared/workspacePolicy.ts';
export type Workspace = {
  id: string;
  name: string;
  type: AccountType;
  publicMetadata: Record<string, unknown>;
  billingCustomerId: string;
  canPurchase: boolean;
  purchaseUnavailableReason?: string;
  reload: () => Promise<void>;
};
export type WorkspaceState = {
  organization: Workspace | null;
  ready: boolean;
  error: string | null;
  isPersonal: boolean;
  accountType: AccountType;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  personalId: string | null;
};
export const WorkspaceContext = createContext<WorkspaceState>({
  organization: null,
  ready: false,
  error: null,
  isPersonal: false,
  accountType: 'business',
  refresh: async () => {},
  select: async () => {},
  personalId: null,
});
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
