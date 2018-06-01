from datetime import timedelta

from django.contrib import admin
from django.utils.timezone import now

from image_cropping import ImageCroppingMixin

from .forms import AboutFaqForm, ArticleForm
from .models import AboutFaq, Article


@admin.register(AboutFaq)
class AboutFaq(admin.ModelAdmin):
    form = AboutFaqForm

    list_display = ('title', 'author', 'published', 'created', 'modified')
    readonly_fields = ('created', 'modified')
    date_hierarchy = ('created')
    ordering = ('created', )
    prepopulated_fields = {'slug': ('title', )}

    # Only allow About and FAQ pages to be edited, not added or deleted
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    # make slug field read-only (cannot add to readonly_fields, because it is pre-populated)
    def get_readonly_fields(self, request, obj=None):
        if obj:
            self.prepopulated_fields = {}
            return self.readonly_fields + ('slug',)
        return self.readonly_fields


@admin.register(Article)
class ArticleAdmin(ImageCroppingMixin, admin.ModelAdmin):
    form = ArticleForm

    list_display = ('title', 'author', 'published', 'created', 'modified')
    readonly_fields = ('created', 'modified')
    date_hierarchy = ('created')
    ordering = ('created', )
    actions = ('make_published', 'make_unpublished')
    prepopulated_fields = {'slug': ('title', )}

    def make_published(self, request, queryset):
        queryset.update(publish_date=now())
    make_published.short_description = 'Publish selected articles'

    def make_unpublished(self, request, queryset):
        # unpublish articles by setting their publication date far in the future
        queryset.update(publish_date=now() + timedelta(days=200 * 365))
    make_unpublished.short_description = 'Unpublish selected articles'
