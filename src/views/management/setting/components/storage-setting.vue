<script setup lang="ts">
import { reactive } from 'vue'
import { useLoading } from '@sa/hooks'
import { fetchFileStorageConfig, upsertFileStorageConfig } from '@/service/api/setting'
import { $t } from '@/locales'

const { loading, startLoading, endLoading } = useLoading(false)

function createDefaultFormModel(): Api.FileStorage.UpsertReq {
  return {
    storage_type: 'local',
    provider: '',
    local: {
      base_dir: './files',
      public_path_prefix: '/files'
    },
    aliyun: {
      access_key_id: '',
      access_key_secret: '',
      endpoint: '',
      bucket: '',
      domain: '',
      dir_prefix: 'uploads/',
      use_https: true
    },
    qiniu: {
      access_key: '',
      secret_key: '',
      bucket: '',
      domain: '',
      dir_prefix: 'uploads/',
      region: 'huadong',
      use_https: true,
      upload_base_url: ''
    },
    remark: ''
  }
}

const formModel = reactive<Api.FileStorage.UpsertReq>(createDefaultFormModel())

const providerOptions = [
  { label: '阿里云 OSS', value: 'aliyun' },
  { label: '七牛云 KODO', value: 'qiniu' }
]

const qiniuRegionOptions = [
  { label: '华东（z0）', value: 'huadong' },
  { label: '华北（z1）', value: 'huabei' },
  { label: '华南（z2）', value: 'huanan' },
  { label: '北美（na0）', value: 'beimei' },
  { label: '新加坡（as0）', value: 'xinjiapo' }
]

async function loadConfig() {
  startLoading()
  try {
    const { data } = await fetchFileStorageConfig()
    if (data) {
      Object.assign(formModel, {
        storage_type: data.storage_type,
        provider: data.provider || '',
        local: data.local,
        aliyun: data.aliyun,
        qiniu: data.qiniu,
        remark: data.remark ?? ''
      })
    }
  } finally {
    endLoading()
  }
}

async function handleSubmit() {
  startLoading()
  try {
    const res = await upsertFileStorageConfig(formModel)
    if (!res.error) {
      window.$message?.success(res.msg)
      await loadConfig()
    }
  } finally {
    endLoading()
  }
}

loadConfig()
</script>

<template>
  <NSpin :show="loading">
    <NForm label-placement="left" :label-width="140" :model="formModel">
      <NGrid :cols="24" :x-gap="18">
        <NFormItemGridItem :span="24" label="存储类型" path="storage_type">
          <NRadioGroup v-model:value="formModel.storage_type">
            <NSpace>
              <NRadio value="local">本地存储</NRadio>
              <NRadio value="cloud">云存储</NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItemGridItem>

        <template v-if="formModel.storage_type === 'cloud'">
          <NFormItemGridItem :span="24" label="存储服务商" path="provider">
            <NSelect v-model:value="formModel.provider" :options="providerOptions" clearable />
          </NFormItemGridItem>

          <template v-if="formModel.provider === 'aliyun'">
            <NFormItemGridItem :span="24" label="访问域名 / CDN域名" path="aliyun.domain">
              <NInput v-model:value="formModel.aliyun.domain" placeholder="例如：https://cdn.example.com" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="Endpoint" path="aliyun.endpoint">
              <NInput v-model:value="formModel.aliyun.endpoint" placeholder="例如：oss-cn-hangzhou.aliyuncs.com" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="Bucket" path="aliyun.bucket">
              <NInput v-model:value="formModel.aliyun.bucket" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="AccessKeyId" path="aliyun.access_key_id">
              <NInput v-model:value="formModel.aliyun.access_key_id" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="AccessKeySecret" path="aliyun.access_key_secret">
              <NInput
                v-model:value="formModel.aliyun.access_key_secret"
                type="password"
                show-password-on="click"
                :placeholder="formModel.aliyun.access_key_secret_set ? '已设置，留空/保持 ******** 则不修改' : ''"
              />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="DirPrefix" path="aliyun.dir_prefix">
              <NInput v-model:value="formModel.aliyun.dir_prefix" placeholder="例如：uploads/" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="HTTPS" path="aliyun.use_https">
              <NSwitch v-model:value="formModel.aliyun.use_https" />
            </NFormItemGridItem>
          </template>

          <template v-else-if="formModel.provider === 'qiniu'">
            <NFormItemGridItem :span="24" label="访问域名" path="qiniu.domain">
              <NInput v-model:value="formModel.qiniu.domain" placeholder="例如：https://cdn.example.com" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="Bucket" path="qiniu.bucket">
              <NInput v-model:value="formModel.qiniu.bucket" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="AccessKey" path="qiniu.access_key">
              <NInput v-model:value="formModel.qiniu.access_key" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="SecretKey" path="qiniu.secret_key">
              <NInput
                v-model:value="formModel.qiniu.secret_key"
                type="password"
                show-password-on="click"
                :placeholder="formModel.qiniu.secret_key_set ? '已设置，留空/保持 ******** 则不修改' : ''"
              />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="Region" path="qiniu.region">
              <NSelect v-model:value="formModel.qiniu.region" :options="qiniuRegionOptions" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="DirPrefix" path="qiniu.dir_prefix">
              <NInput v-model:value="formModel.qiniu.dir_prefix" placeholder="例如：uploads/" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="直传上传域名(可选)" path="qiniu.upload_base_url">
              <NInput v-model:value="formModel.qiniu.upload_base_url" placeholder="默认：https://up.qiniup.com" />
            </NFormItemGridItem>
            <NFormItemGridItem :span="24" label="HTTPS" path="qiniu.use_https">
              <NSwitch v-model:value="formModel.qiniu.use_https" />
            </NFormItemGridItem>
          </template>
        </template>

        <template v-else>
          <NFormItemGridItem :span="24" label="本地存储目录(高级)" path="local.base_dir">
            <NInput v-model:value="formModel.local.base_dir" placeholder="./files" />
          </NFormItemGridItem>
          <NFormItemGridItem :span="24" label="公开访问前缀(高级)" path="local.public_path_prefix">
            <NInput v-model:value="formModel.local.public_path_prefix" placeholder="/files" />
          </NFormItemGridItem>
        </template>

        <NFormItemGridItem :span="24" :label="$t('common.remark')" path="remark">
          <NInput v-model:value="formModel.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItemGridItem>

        <NFormItemGridItem :span="24" class="mt-10px">
          <div class="w-140px"></div>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.save') }}</NButton>
        </NFormItemGridItem>
      </NGrid>
    </NForm>
  </NSpin>
</template>

<style scoped lang="scss"></style>
