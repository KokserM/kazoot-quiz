import { useEffect, useState } from 'react';
import { fetchBillingCatalog, fetchConfig } from './api';

// Public server configuration, fetched once per page load.
let configPromise = null;
let catalogPromise = null;

export function useConfig() {
  const [state, setState] = useState({ config: null, error: null });
  useEffect(() => {
    let active = true;
    configPromise = configPromise || fetchConfig().catch((error) => {
      configPromise = null;
      throw error;
    });
    configPromise.then(
      (config) => active && setState({ config, error: null }),
      (error) => active && setState({ config: null, error })
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function useCatalog() {
  const [state, setState] = useState({ plans: null, error: null });
  useEffect(() => {
    let active = true;
    catalogPromise = catalogPromise || fetchBillingCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
    catalogPromise.then(
      (data) => active && setState({ plans: data.plans || [], error: null }),
      (error) => active && setState({ plans: null, error })
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
