const activeWorkbookDownloads = new Map();

export async function downloadWorkbook(url) {
  const downloadUrl = toDownloadUrl(url);

  if (activeWorkbookDownloads.has(downloadUrl)) {
    return activeWorkbookDownloads.get(downloadUrl);
  }

  const download = downloadWorkbookWithRetries(downloadUrl).finally(() => {
    activeWorkbookDownloads.delete(downloadUrl);
  });

  activeWorkbookDownloads.set(downloadUrl, download);
  return download;
}

async function downloadWorkbookWithRetries(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await downloadWorkbookOnce(url);
    } catch (error) {
      lastError = error;

      if (!isRetryableDownloadError(error) || attempt === 3) {
        throw error;
      }

      await delay(attempt * 1000);
    }
  }

  throw lastError;
}

async function downloadWorkbookOnce(url) {
  const response = await fetchWithCookies(url);

  if (!response.ok) {
    throw new Error(`Download da planilha falhou com status ${response.status}.`, {
      cause: { status: response.status }
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());

  if (!isXlsx(buffer, contentType)) {
    throw new Error(`A resposta da planilha não parece ser um arquivo XLSX. Content-Type: ${contentType || 'desconhecido'}.`);
  }

  return buffer;
}

function isRetryableDownloadError(error) {
  const message = String(error?.message || '');
  const status = error?.cause?.status;

  return status === 429 || status === 503 || message.includes('status 429') || message.includes('status 503');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithCookies(initialUrl) {
  const cookieJar = new Map();
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount < 10; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: requestHeaders(cookieJar)
    });

    storeCookies(response, cookieJar);

    if (isRedirect(response)) {
      currentUrl = new URL(response.headers.get('location'), currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error('Muitos redirecionamentos ao baixar a planilha.');
}

function requestHeaders(cookieJar) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
  };

  if (cookieJar.size) {
    headers.Cookie = [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  return headers;
}

function storeCookies(response, cookieJar) {
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');

    if (separator > 0) {
      cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
}

function isRedirect(response) {
  return response.status >= 300 && response.status < 400 && Boolean(response.headers.get('location'));
}

function toDownloadUrl(url) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname === '1drv.ms' && parsedUrl.pathname.startsWith('/x/')) {
    parsedUrl.searchParams.set('download', '1');
  }

  return parsedUrl.toString();
}

function isXlsx(buffer, contentType) {
  const normalizedContentType = contentType.toLowerCase();
  const hasZipSignature = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  return (
    hasZipSignature &&
    (normalizedContentType.includes('spreadsheetml.sheet') ||
      normalizedContentType.includes('application/octet-stream') ||
      !normalizedContentType)
  );
}
