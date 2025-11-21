export interface UserAdmin {
  id: string;
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  isWaitlisted: boolean;
  isAdmin?: boolean;

  workspaceCount: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  isWaitlisted: boolean;
  isAdmin?: boolean;

  settings: UserSetting;
}

export interface UserSetting {
  automaticallyAcceptPatches: boolean;
  evalBeforeAccept: boolean;
  anthropicModel?: string; // Anthropic model ID (e.g., 'claude-sonnet-4-5-20250929')
}
