import { createContext } from 'react';

export interface AuthState {
  isAuthenticated: boolean;
  isAuthRequired: boolean;
  isAuthDisabled: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// The context and the hook live outside AuthContext.tsx so that file exports
// only its component. react-refresh/only-export-components fires otherwise,
// and mixing components with other exports genuinely does break fast refresh
// for the whole module.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
