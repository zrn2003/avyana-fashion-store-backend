import https from 'https';
import http from 'http';

export interface PincodeDetails {
  pincode: string;
  city: string;
  district: string;
  state: string;
  postOffices: string[];
  isDeliverable: boolean;
  source: 'DATA_GOV_IN' | 'INDIA_POST' | 'POSTAL_CACHE';
}

const memoryCache = new Map<string, PincodeDetails>();

// Comprehensive offline state mapper by Indian Postal Circle (First 2 digits of PIN)
const postalPrefixStateMap: Record<string, { state: string; defaultCity: string }> = {
  '11': { state: 'Delhi', defaultCity: 'New Delhi' },
  '12': { state: 'Haryana', defaultCity: 'Gurugram' },
  '13': { state: 'Haryana', defaultCity: 'Ambala' },
  '14': { state: 'Punjab', defaultCity: 'Amritsar' },
  '15': { state: 'Punjab', defaultCity: 'Bathinda' },
  '16': { state: 'Chandigarh', defaultCity: 'Chandigarh' },
  '17': { state: 'Himachal Pradesh', defaultCity: 'Shimla' },
  '18': { state: 'Jammu & Kashmir', defaultCity: 'Jammu' },
  '19': { state: 'Jammu & Kashmir', defaultCity: 'Srinagar' },
  '20': { state: 'Uttar Pradesh', defaultCity: 'Aligarh' },
  '21': { state: 'Uttar Pradesh', defaultCity: 'Allahabad' },
  '22': { state: 'Uttar Pradesh', defaultCity: 'Lucknow' },
  '23': { state: 'Uttar Pradesh', defaultCity: 'Varanasi' },
  '24': { state: 'Uttarakhand', defaultCity: 'Dehradun' },
  '25': { state: 'Uttar Pradesh', defaultCity: 'Meerut' },
  '26': { state: 'Uttar Pradesh', defaultCity: 'Bareilly' },
  '27': { state: 'Uttar Pradesh', defaultCity: 'Gorakhpur' },
  '28': { state: 'Uttar Pradesh', defaultCity: 'Agra' },
  '30': { state: 'Rajasthan', defaultCity: 'Jaipur' },
  '31': { state: 'Rajasthan', defaultCity: 'Udaipur' },
  '32': { state: 'Rajasthan', defaultCity: 'Kota' },
  '33': { state: 'Rajasthan', defaultCity: 'Bikaner' },
  '34': { state: 'Rajasthan', defaultCity: 'Jodhpur' },
  '36': { state: 'Gujarat', defaultCity: 'Rajkot' },
  '37': { state: 'Gujarat', defaultCity: 'Jamnagar' },
  '38': { state: 'Gujarat', defaultCity: 'Ahmedabad' },
  '39': { state: 'Gujarat', defaultCity: 'Surat' },
  '40': { state: 'Maharashtra', defaultCity: 'Mumbai' },
  '41': { state: 'Maharashtra', defaultCity: 'Pune' },
  '42': { state: 'Maharashtra', defaultCity: 'Nashik' },
  '43': { state: 'Maharashtra', defaultCity: 'Aurangabad' },
  '44': { state: 'Maharashtra', defaultCity: 'Nagpur' },
  '45': { state: 'Madhya Pradesh', defaultCity: 'Indore' },
  '46': { state: 'Madhya Pradesh', defaultCity: 'Bhopal' },
  '47': { state: 'Madhya Pradesh', defaultCity: 'Gwalior' },
  '48': { state: 'Madhya Pradesh', defaultCity: 'Jabalpur' },
  '49': { state: 'Chhattisgarh', defaultCity: 'Raipur' },
  '50': { state: 'Telangana', defaultCity: 'Hyderabad' },
  '51': { state: 'Andhra Pradesh', defaultCity: 'Tirupati' },
  '52': { state: 'Andhra Pradesh', defaultCity: 'Vijayawada' },
  '53': { state: 'Andhra Pradesh', defaultCity: 'Visakhapatnam' },
  '56': { state: 'Karnataka', defaultCity: 'Bengaluru' },
  '57': { state: 'Karnataka', defaultCity: 'Mangaluru' },
  '58': { state: 'Karnataka', defaultCity: 'Hubballi' },
  '59': { state: 'Karnataka', defaultCity: 'Belagavi' },
  '60': { state: 'Tamil Nadu', defaultCity: 'Chennai' },
  '61': { state: 'Tamil Nadu', defaultCity: 'Thanjavur' },
  '62': { state: 'Tamil Nadu', defaultCity: 'Madurai' },
  '63': { state: 'Tamil Nadu', defaultCity: 'Salem' },
  '64': { state: 'Tamil Nadu', defaultCity: 'Coimbatore' },
  '67': { state: 'Kerala', defaultCity: 'Kozhikode' },
  '68': { state: 'Kerala', defaultCity: 'Kochi' },
  '69': { state: 'Kerala', defaultCity: 'Thiruvananthapuram' },
  '70': { state: 'West Bengal', defaultCity: 'Kolkata' },
  '71': { state: 'West Bengal', defaultCity: 'Howrah' },
  '72': { state: 'West Bengal', defaultCity: 'Midnapore' },
  '73': { state: 'West Bengal', defaultCity: 'Siliguri' },
  '74': { state: 'West Bengal', defaultCity: 'North 24 Parganas' },
  '75': { state: 'Odisha', defaultCity: 'Bhubaneswar' },
  '76': { state: 'Odisha', defaultCity: 'Cuttack' },
  '78': { state: 'Assam', defaultCity: 'Guwahati' },
  '79': { state: 'Northeast (Arunachal/Manipur/Meghalaya)', defaultCity: 'Shillong' },
  '80': { state: 'Bihar', defaultCity: 'Patna' },
  '81': { state: 'Bihar', defaultCity: 'Bhagalpur' },
  '82': { state: 'Jharkhand', defaultCity: 'Ranchi' },
  '83': { state: 'Jharkhand', defaultCity: 'Jamshedpur' },
  '84': { state: 'Bihar', defaultCity: 'Muzaffarpur' },
  '85': { state: 'Bihar', defaultCity: 'Purnia' },
};

function fetchJsonWithTimeout(url: string, timeoutMs = 3500): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;

    const req = client.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'application/json',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP Status ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error('Invalid JSON received'));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err) => reject(err));
  });
}

export class PincodeService {
  private static DATA_GOV_API_KEY =
    process.env.DATA_GOV_IN_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

  /**
   * Looks up an Indian 6-digit postal code.
   * Uses data.gov.in All India Pincode Directory API with India Post failover.
   */
  static async lookup(rawPincode: string): Promise<PincodeDetails | null> {
    const cleanPin = String(rawPincode || '').replace(/\D/g, '').trim();

    if (cleanPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
      return null;
    }

    // 1. Check in-memory LRU cache
    if (memoryCache.has(cleanPin)) {
      return memoryCache.get(cleanPin)!;
    }

    // 2. Primary Provider: Official data.gov.in Resource (All India Pincode Directory)
    try {
      const dataGovUrl = `https://api.data.gov.in/resource/6176ee09-3d56-4a3b-8115-21841576b2f6?api-key=${encodeURIComponent(
        this.DATA_GOV_API_KEY
      )}&format=json&filters[pincode]=${encodeURIComponent(cleanPin)}&limit=10`;

      const response = await fetchJsonWithTimeout(dataGovUrl, 3000);
      const records = response?.records || response?.data || [];

      if (Array.isArray(records) && records.length > 0) {
        const first = records[0];
        const offices = records.map((r: any) => r.officename || r.office_name || r.name).filter(Boolean);
        const district = first.district || first.District || first.districtname || '';
        const state = first.statename || first.State || first.state || '';
        const city = district || first.divisionname || first.regionname || 'Metro';

        const result: PincodeDetails = {
          pincode: cleanPin,
          city: city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
          district: district.charAt(0).toUpperCase() + district.slice(1).toLowerCase(),
          state: state.trim(),
          postOffices: offices,
          isDeliverable: true,
          source: 'DATA_GOV_IN',
        };

        memoryCache.set(cleanPin, result);
        return result;
      }
    } catch (err: any) {
      console.warn(`[PincodeService] data.gov.in lookup failed for ${cleanPin} (${err.message}), falling back to India Post API...`);
    }

    // 3. Fallback 1: PostalPincode.in (India Post public directory API)
    try {
      const postalUrl = `https://api.postalpincode.in/pincode/${cleanPin}`;
      const response = await fetchJsonWithTimeout(postalUrl, 3000);

      if (Array.isArray(response) && response[0]?.Status === 'Success' && Array.isArray(response[0]?.PostOffice)) {
        const postOffices = response[0].PostOffice;
        const first = postOffices[0];
        const district = first.District || first.Block || '';
        const state = first.State || '';
        const offices = postOffices.map((po: any) => po.Name).filter(Boolean);

        const result: PincodeDetails = {
          pincode: cleanPin,
          city: district || first.Name || 'Metro',
          district,
          state,
          postOffices: offices,
          isDeliverable: true,
          source: 'INDIA_POST',
        };

        memoryCache.set(cleanPin, result);
        return result;
      }
    } catch (err: any) {
      console.warn(`[PincodeService] postalpincode.in fallback failed for ${cleanPin} (${err.message})`);
    }

    // 4. Fallback 2: Offline Postal Matrix Heuristic
    const prefix2 = cleanPin.slice(0, 2);
    if (postalPrefixStateMap[prefix2]) {
      const { state, defaultCity } = postalPrefixStateMap[prefix2];
      const result: PincodeDetails = {
        pincode: cleanPin,
        city: defaultCity,
        district: defaultCity,
        state,
        postOffices: [`${defaultCity} H.O. (${cleanPin})`],
        isDeliverable: true,
        source: 'POSTAL_CACHE',
      };
      memoryCache.set(cleanPin, result);
      return result;
    }

    return null;
  }
}
