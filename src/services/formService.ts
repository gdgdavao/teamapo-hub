import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Minimal types used by admin forms pages
export interface BasicEvent {
  id: string;
  title: string;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  gridSize?: 'full' | 'half';
}

export interface CustomForm {
  id: string;
  name: string;
  type: 'registration' | 'feedback';
  description: string;
  fields: FormField[];
  isActive: boolean;
  createdAt?: any;
  usageCount?: number;
  eventId?: string;
  eventTitle?: string;
}

const EVENTS_COLLECTION = 'events';
const FORMS_LIBRARY_COLLECTION = 'forms_library';

export class FormService {
  static async getAllEvents(): Promise<BasicEvent[]> {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const q = query(eventsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, title: String(d.data().title || 'Untitled') }));
  }

  // Global forms library stored at top-level collection forms_library
  static async getAllForms(): Promise<CustomForm[]> {
    const formsRef = collection(db, FORMS_LIBRARY_COLLECTION);
    const q = query(formsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  static async createForm(form: Omit<CustomForm, 'id' | 'createdAt' | 'usageCount'>): Promise<CustomForm> {
    const formsRef = collection(db, FORMS_LIBRARY_COLLECTION);
    const payload: any = {
      ...form,
      createdAt: serverTimestamp(),
      usageCount: 0
    };
    const ref = await addDoc(formsRef, payload);
    return { id: ref.id, ...payload } as CustomForm;
  }

  static async updateForm(id: string, updates: Partial<CustomForm>): Promise<void> {
    const ref = doc(db, FORMS_LIBRARY_COLLECTION, id);
    const payload = { ...updates } as any;
    await updateDoc(ref, payload);
  }

  static async deleteForm(id: string): Promise<void> {
    const ref = doc(db, FORMS_LIBRARY_COLLECTION, id);
    await deleteDoc(ref);
  }
}

export default FormService;
