import { UserProfile } from '../types';

const mockUsers: UserProfile[] = [
  {
    id: 'user-1',
    username: 'el_acordeon',
    firstName: 'Carlos',
    lastName: 'Ramírez',
    country: 'Mexico',
    city: 'Monterrey',
    state: 'Nuevo León',
    instruments: ['Accordion', 'Vocals'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: 'user-2',
    username: 'bajo_sexto_mx',
    firstName: 'Miguel',
    country: 'Mexico',
    city: 'Reynosa',
    state: 'Tamaulipas',
    instruments: ['Bajo Sexto', 'Guitar'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: 'user-3',
    username: 'tololoche_queen',
    firstName: 'María',
    lastName: 'González',
    country: 'United States',
    city: 'Los Angeles',
    state: 'California',
    instruments: ['Tololoche', 'Vocals'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
];

let usersStore = [...mockUsers];

export async function getUsers(): Promise<UserProfile[]> {
  return [...usersStore];
}

export async function getUserById(id: string): Promise<UserProfile | undefined> {
  return usersStore.find((u) => u.id === id);
}

export async function getUserByUsername(username: string): Promise<UserProfile | undefined> {
  const normalized = username.toLowerCase().trim();
  return usersStore.find((u) => u.username.toLowerCase() === normalized);
}

export async function createUser(
  data: Omit<UserProfile, 'id' | 'createdAt'>,
): Promise<UserProfile> {
  const user: UserProfile = {
    ...data,
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  usersStore = [user, ...usersStore];
  return user;
}

export async function updateUser(
  id: string,
  data: Partial<Omit<UserProfile, 'id' | 'createdAt'>>,
): Promise<UserProfile | undefined> {
  const index = usersStore.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  usersStore[index] = { ...usersStore[index], ...data };
  return usersStore[index];
}

export function resetUsersStore(): void {
  usersStore = [...mockUsers];
}
