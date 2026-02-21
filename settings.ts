import { App, PluginSettingTab, Setting } from 'obsidian';
import S3ImagesPlugin from './main';

export class S3ImagesSettingTab extends PluginSettingTab {
	plugin: S3ImagesPlugin;

	constructor(app: App, plugin: S3ImagesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('AWS Access Key ID')
			.addText(text => text
				.setPlaceholder('AKIAIOSFODNN7EXAMPLE')
				.setValue(this.plugin.settings.accessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.accessKeyId = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('AWS Secret Access Key')
			.addText(text => {
				text
					.setPlaceholder('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
					.setValue(this.plugin.settings.secretAccessKey)
					.onChange(async (value) => {
						this.plugin.settings.secretAccessKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Region')
			.addText(text => text
				.setPlaceholder('ap-northeast-2')
				.setValue(this.plugin.settings.region)
				.onChange(async (value) => {
					this.plugin.settings.region = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Bucket Name')
			.addText(text => text
				.setPlaceholder('my-obsidian-images')
				.setValue(this.plugin.settings.bucket)
				.onChange(async (value) => {
					this.plugin.settings.bucket = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Path Prefix')
			.setDesc('S3 업로드 경로 prefix (예: obsidian/images)')
			.addText(text => text
				.setPlaceholder('obsidian/images')
				.setValue(this.plugin.settings.pathPrefix)
				.onChange(async (value) => {
					this.plugin.settings.pathPrefix = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
