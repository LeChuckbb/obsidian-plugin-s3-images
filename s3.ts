// AWS Signature Version 4 구현 (Web Crypto API 사용, 런타임 의존성 없음)

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

function toUint8(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
	const input = typeof data === 'string' ? toUint8(data) : data;
	const hash = await crypto.subtle.digest('SHA-256', input);
	return toHex(hash);
}

async function hmacSha256(key: CryptoKey, data: string): Promise<ArrayBuffer> {
	return crypto.subtle.sign('HMAC', key, toUint8(data));
}

async function importHmacKey(raw: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		raw,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
}

async function getSigningKey(
	secret: string,
	date: string,
	region: string,
	service: string
): Promise<CryptoKey> {
	const kDate = await hmacSha256(
		await importHmacKey(toUint8('AWS4' + secret)),
		date
	);
	const kRegion = await hmacSha256(await importHmacKey(kDate), region);
	const kService = await hmacSha256(await importHmacKey(kRegion), service);
	const kSigning = await hmacSha256(await importHmacKey(kService), 'aws4_request');
	return importHmacKey(kSigning);
}

// 경로 세그먼트별 URI 인코딩 ('/' 는 인코딩하지 않음)
function encodeS3Key(key: string): string {
	return key.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

export interface S3PutObjectParams {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	bucket: string;
	key: string;
	body: ArrayBuffer;
	contentType: string;
}

export interface S3PutObjectResult {
	url: string;
	headers: Record<string, string>;
}

export async function signS3PutObject(params: S3PutObjectParams): Promise<S3PutObjectResult> {
	const { accessKeyId, secretAccessKey, region, bucket, key, body, contentType } = params;

	const now = new Date();
	// ISO 8601 형식: YYYYMMDDTHHMMSSZ
	const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	// 날짜만: YYYYMMDD
	const dateStamp = amzDate.slice(0, 8);

	const host = `${bucket}.s3.${region}.amazonaws.com`;
	const encodedKey = encodeS3Key(key);
	const url = `https://${host}/${encodedKey}`;

	// 큰 파일 성능을 위해 본문 해싱 생략 (UNSIGNED-PAYLOAD)
	const payloadHash = 'UNSIGNED-PAYLOAD';

	const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

	// Canonical Request 구성
	const canonicalRequest = [
		'PUT',
		`/${encodedKey}`,
		'',  // query string (없음)
		`content-type:${contentType}`,
		`host:${host}`,
		`x-amz-content-sha256:${payloadHash}`,
		`x-amz-date:${amzDate}`,
		'',  // 헤더 목록 끝 빈 줄
		signedHeaders,
		payloadHash,
	].join('\n');

	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const canonicalRequestHash = await sha256Hex(canonicalRequest);

	// String to Sign
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		canonicalRequestHash,
	].join('\n');

	// 서명 계산
	const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, 's3');
	const signatureBuffer = await hmacSha256(signingKey, stringToSign);
	const signature = toHex(signatureBuffer);

	// Authorization 헤더
	const authorization = [
		`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
		`SignedHeaders=${signedHeaders}`,
		`Signature=${signature}`,
	].join(', ');

	const headers: Record<string, string> = {
		'Authorization': authorization,
		'Content-Type': contentType,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate,
	};

	return { url, headers };
}
