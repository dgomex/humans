import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

const CHUNK = 500;

/**
 * Page 011 — contact sync. Reads only email addresses, hashes each one ON THE DEVICE
 * (SHA-256 of the trimmed, lowercased address) and uploads just the hashes. Raw contacts never
 * leave the phone. Returns how many hashes were uploaded, or null if permission was denied.
 */
export async function syncContacts(): Promise<number | null> {
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) return null;

  const details = await Contacts.Contact.getAllDetails([Contacts.ContactField.EMAILS]);
  const emails = new Set<string>();
  for (const contact of details) {
    for (const e of contact.emails ?? []) {
      const address = e.address?.trim().toLowerCase();
      if (address && address.includes('@')) emails.add(address);
    }
  }

  const hashes = await Promise.all(
    [...emails].map((address) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, address),
    ),
  );

  for (let i = 0; i < hashes.length; i += CHUNK) {
    const rows = hashes.slice(i, i + CHUNK).map((hash) => ({ hash }));
    const { error } = await supabase
      .from('contact_hashes')
      .upsert(rows, { onConflict: 'owner_id,hash', ignoreDuplicates: true });
    if (error) throw error;
  }
  return hashes.length;
}
