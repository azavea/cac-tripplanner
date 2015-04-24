from django.contrib import admin

from .forms import AboutFaqForm, ArticleForm
from .models import AboutFaq, Article


@admin.register(AboutFaq)
class ArticleAdmin(admin.ModelAdmin):
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


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    form = ArticleForm

    list_display = ('title', 'author', 'published', 'created', 'modified')
    readonly_fields = ('created', 'modified')
    date_hierarchy = ('created')
    ordering = ('created', )
    actions = ('make_published', 'make_unpublished')
    prepopulated_fields = {'slug': ('title', )}

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = 'Publish selected articles'

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = 'Unpublish selected articles'
