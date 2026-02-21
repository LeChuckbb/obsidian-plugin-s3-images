# S3 Images — Obsidian 플러그인

붙여넣기 또는 드래그로 이미지를 **AWS S3**에 자동 업로드하고, 노트에 마크다운 링크를 삽입합니다. 런타임 의존성이 없습니다.

## 주요 기능

- **붙여넣기 & 드롭 지원** — Obsidian이 처리하기 전에 `editor-paste` / `editor-drop` 이벤트를 가로챕니다
- **제로 런타임 의존성** — AWS Signature Version 4(SigV4)를 Web Crypto API(`SubtleCrypto`)로 직접 구현. AWS SDK 미포함
- **고유 키 생성** — 이미지를 `{prefix}/{timestamp}-{random6}.{ext}` 형식으로 저장해 충돌 방지
- **경로 프리픽스 설정** — S3 키 프리픽스를 자유롭게 지정 (예: `obsidian/images`)
- **데스크톱 전용** — Obsidian의 `requestUrl` API를 사용해 CORS 없이 안전하게 업로드

## 아키텍처

```mermaid
sequenceDiagram
    participant U as 사용자
    participant O as Obsidian 에디터
    participant P as S3 Images 플러그인
    participant S as AWS S3

    U->>O: 이미지 붙여넣기 / 드롭
    O->>P: editor-paste / editor-drop 이벤트
    P->>P: 고유 키 생성<br/>{prefix}/{timestamp}-{random}.{ext}
    P->>P: 요청 서명 (SigV4)<br/>HMAC-SHA256, 의존성 없음
    P->>S: PUT /{bucket}/{key}<br/>Content-Type: image/*
    S-->>P: 200 OK
    P->>O: 마크다운 링크 삽입<br/>![name](https://bucket.s3.region.amazonaws.com/key)
    O->>U: 노트에 이미지 표시
```

## 설치 및 설정

### 1. 플러그인 설치

커뮤니티 플러그인 디렉토리에 등록되기 전까지 수동으로 설치합니다:

1. [최신 릴리스](../../releases/latest)에서 `main.js`, `manifest.json`, `styles.css`를 다운로드합니다.
2. 볼트 경로에 복사합니다: `<vault>/.obsidian/plugins/s3-images/`
3. **설정 → 커뮤니티 플러그인**에서 플러그인을 활성화합니다.

### 2. AWS 설정

**S3 버킷 생성**

1. [S3 콘솔](https://s3.console.aws.amazon.com/)에서 버킷을 생성합니다.
2. **퍼블릭 액세스**를 허용하거나, `GetObject`를 허용하는 버킷 정책을 구성합니다.
3. 원하는 리전을 선택합니다 (예: `ap-northeast-2`).

**IAM 사용자 생성**

1. [IAM 콘솔](https://console.aws.amazon.com/iam/)에서 새 사용자를 생성합니다.
2. 아래 [보안](#보안) 섹션의 최소 권한 정책을 연결합니다.
3. **액세스 키 ID**와 **시크릿 액세스 키**를 발급합니다.

### 3. 플러그인 설정 항목

**설정 → S3 Images**를 열고 아래 항목을 입력합니다:

| 설정 항목 | 설명 | 예시 |
|---|---|---|
| AWS Access Key ID | IAM 사용자 액세스 키 | `AKIAIOSFODNN7EXAMPLE` |
| AWS Secret Access Key | IAM 사용자 시크릿 키 | `wJalrXUtnFEMI/K7MDENG/...` |
| Region | 버킷이 위치한 AWS 리전 | `ap-northeast-2` |
| Bucket Name | S3 버킷 이름 | `my-obsidian-images` |
| Path Prefix | 업로드 이미지의 S3 키 프리픽스 | `obsidian/images` |

## 보안

### 최소 권한 IAM 정책

플러그인에 필요한 권한만 부여합니다 — 특정 버킷에 대한 `PutObject`만 허용:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObsidianS3ImagesUpload",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

`YOUR_BUCKET_NAME`을 실제 버킷 이름으로 교체하세요.

### 크리덴셜 저장 방식

크리덴셜은 Obsidian의 `saveData` / `loadData` API를 통해 `<vault>/.obsidian/plugins/s3-images/data.json`에 로컬 저장됩니다. 볼트 디렉토리를 외부에 공개하지 않도록 주의하고, **`data.json`을 버전 관리에 커밋하지 마세요** (`.gitignore`에 포함되어 있습니다).

## 블로그 등 외부 서빙 시 참고

S3는 파일 저장소일 뿐이므로, 블로그에서 이미지를 서빙할 때는 추가 구성이 필요합니다.

| 필요 사항 | S3 단독 | 해결 방법 |
|-----------|---------|-----------|
| CDN | 미포함 — S3 리전에서 직접 서빙 | CloudFront 연결 |
| 이미지 변환 (리사이징, WebP) | 미지원 | 빌드 타임: `next/image`, Sharp / 런타임: Lambda@Edge |
| 캐시 전략 | 기본값만 적용 | Cache-Control 헤더 + CloudFront 무효화 정책 |

> **현재 Obsidian 개인 용도에서는 불필요합니다.** 블로그 프레임워크(Next.js, Astro 등)가 이미지 최적화를 내장하고 있어 S3 URL만 넘기면 대부분 자동 처리됩니다. CloudFront도 그때 붙이면 됩니다.
