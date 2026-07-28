export function withOperationalContactPhones(clubConfig) {
  const phonesByArea = {
    Secretaria: '+55 47 98888-0001',
    Ecônomo: '+55 47 98888-0002',
    Esportes: '+55 47 98888-0003',
    Tesouraria: '+55 47 98888-0004',
    Social: '+55 47 98888-0005'
  };

  return {
    ...clubConfig,
    contacts: clubConfig.contacts.map((contact) => ({
      ...contact,
      phone: phonesByArea[contact.area] || contact.phone
    }))
  };
}
