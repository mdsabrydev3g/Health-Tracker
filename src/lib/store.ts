"use client";

import { create } from "zustand";
import { api } from "./api";

export interface Person {
  id: string;
  nameAr: string;
  dob: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[];
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  colorTag: string;
  timezone: string;
  isManagedUser: boolean;
}

interface AppState {
  persons: Person[];
  selectedPersonId: string | null;
  loading: boolean;
  motherMode: boolean;
  loadPersons: () => Promise<void>;
  selectPerson: (id: string) => void;
  setMotherMode: (v: boolean) => void;
}

export const useApp = create<AppState>((set, get) => ({
  persons: [],
  selectedPersonId: null,
  loading: false,
  motherMode: false,
  loadPersons: async () => {
    set({ loading: true });
    try {
      const persons = await api<Person[]>("/api/persons");
      const prev = get().selectedPersonId;
      set({
        persons,
        loading: false,
        selectedPersonId:
          prev && persons.some((p) => p.id === prev)
            ? prev
            : (persons.find((p) => p.isManagedUser) ?? persons[0])?.id ?? null,
      });
    } catch {
      set({ loading: false });
    }
  },
  selectPerson: (id) => set({ selectedPersonId: id }),
  setMotherMode: (v) => set({ motherMode: v }),
}));

export function selectedPerson(s: AppState): Person | null {
  return s.persons.find((p) => p.id === s.selectedPersonId) ?? null;
}
