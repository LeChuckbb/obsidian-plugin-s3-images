import { Editor, Plugin, requestUrl, Notice } from 'obsidian';
import { S3ImagesSettingTab } from './settings';
import { signS3PutObject } from './s3';

interface Settings {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	bucket: string;
	pathPrefix: string;
}

const DEFAULT_SETTINGS: Settings = {
	accessKeyId: '',
	secretAccessKey: '',
	region: 'ap-northeast-2',
	bucket: '',
	pathPrefix: 'obsidian/images',
};

export default class S3ImagesPlugin extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new S3ImagesSettingTab(this.app, this));

		// 이미지 붙여넣기 이벤트 감지
		this.registerEvent(
			this.app.workspace.on('editor-paste', this.handlePaste.bind(this))
		);

		// 이미지 드래그앤드롭 이벤트 감지
		this.registerEvent(
			this.app.workspace.on('editor-drop', this.handleDrop.bind(this))
		);
	}

	onunload() {}

	async handlePaste(evt: ClipboardEvent, editor: Editor) {
		const items = evt.clipboardData?.items;
		if (!items) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				evt.preventDefault();

				const file = item.getAsFile();
				if (file) {
					try {
						const imageUrl = await this.uploadToS3(file);
						if (imageUrl) {
							editor.replaceSelection(`![obsidian image](${imageUrl})`);
						}
					} catch (error) {
						new Notice(`Failed to upload image: ${error.message}`, 5000);
					}
				}
			}
		}
	}

	async handleDrop(evt: DragEvent, editor: Editor) {
		const files = evt.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const imageFiles = Array.from(files).filter(file =>
			file.type.startsWith('image/')
		);

		if (imageFiles.length === 0) return;

		evt.preventDefault();

		for (const file of imageFiles) {
			try {
				new Notice(`Uploading ${file.name}...`, 2000);
				const imageUrl = await this.uploadToS3(file);
				if (imageUrl) {
					const cursor = editor.getCursor();
					editor.replaceRange(`![${file.name}](${imageUrl})\n`, cursor);
					editor.setCursor(cursor.line + 1, 0);
				}
			} catch (error) {
				new Notice(`Failed to upload ${file.name}: ${error.message}`, 5000);
			}
		}
	}

	async uploadToS3(file: File): Promise<string | undefined> {
		const { accessKeyId, secretAccessKey, region, bucket, pathPrefix } = this.settings;

		if (!accessKeyId || !secretAccessKey || !region || !bucket) {
			new Notice('S3 설정을 확인하세요 (Access Key, Region, Bucket)', 5000);
			return;
		}

		// 키 생성: {pathPrefix}/{timestamp}-{random6}.{ext}
		const ext = file.name.split('.').pop() ?? 'png';
		const timestamp = Date.now();
		const random = Math.random().toString(36).slice(2, 8);
		const prefix = pathPrefix.replace(/\/$/, '');
		const key = `${prefix}/${timestamp}-${random}.${ext}`;

		const body = await file.arrayBuffer();
		const contentType = file.type || 'application/octet-stream';

		const { url, headers } = await signS3PutObject({
			accessKeyId,
			secretAccessKey,
			region,
			bucket,
			key,
			body,
			contentType,
		});

		await requestUrl({
			url,
			method: 'PUT',
			headers,
			body,
		});

		// 퍼블릭 URL 반환
		return url;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
