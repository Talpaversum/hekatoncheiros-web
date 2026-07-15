export const PLATFORM_SUPERADMIN = "platform.superadmin";

export function hasPrivilege(userPrivs: string[] = [], required: string): boolean {
  if (userPrivs.includes(PLATFORM_SUPERADMIN)) return true;
  if (userPrivs.includes(required)) {
    return true;
  }

  return false;
}
