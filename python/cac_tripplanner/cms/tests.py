from datetime import timedelta

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase, Client
from django.utils.timezone import now

from cms.models import Article


class ArticleTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username='test-user')

        common_args = dict(teaser='None', content='None', author=user)

        publish_date = now() - timedelta(hours=1)

        self.client = Client()

        self.unpublished_comm = Article.objects.create(
            content_type=Article.ArticleTypes.community_profile,
            title='unpublished-comm',
            slug='unpublished-comm',
            **common_args)
        self.unpublished_tips = Article.objects.create(
            content_type=Article.ArticleTypes.tips_and_tricks,
            title='unpublished-tips',
            slug='unpublished-tips',
            **common_args)
        self.published_comm = Article.objects.create(
            content_type=Article.ArticleTypes.community_profile,
            publish_date=publish_date,
            title='published-comm',
            slug='published-comm',
            **common_args)
        self.published_tips = Article.objects.create(
            content_type=Article.ArticleTypes.tips_and_tricks,
            publish_date=publish_date,
            title='published-tips',
            slug='published-tips',
            **common_args)

    def test_home_view(self):
        """Verify that home view includes both tips and a community profile"""
        url = reverse('home')
        response = self.client.get(url)
        self.assertContains(response, self.published_comm.slug, count=2, status_code=200)
        self.assertContains(response, self.published_tips.slug, count=2, status_code=200)

    def test_community_profile_manager(self):
        """Test that community profile manager works"""
        community_profiles_count = Article.profiles.count()
        self.assertEqual(community_profiles_count, 2)

        published_community_profiles_count = Article.profiles.published().count()
        self.assertEqual(published_community_profiles_count, 1)

        random_community_profile = Article.profiles.random()
        test_dictionary = {'title': self.published_comm.title,
                           'slug': self.published_comm.slug,
                           'narrow_image': '/media/',
                           'wide_image': '/media/'}
        self.assertDictEqual(random_community_profile, test_dictionary)

    def test_tips_and_tricks_manager(self):
        """Test that community profile manager works"""

        tips_count = Article.tips.count()
        self.assertEqual(tips_count, 2)

        published_tips_count = Article.tips.published().count()
        self.assertEqual(published_tips_count, 1)

        random_tips = Article.tips.random()
        test_dictionary = {'title': self.published_tips.title,
                           'slug': self.published_tips.slug,
                           'narrow_image': '/media/',
                           'wide_image': '/media/'}
        self.assertDictEqual(random_tips, test_dictionary)

    def test_article_manager(self):
        """Test that community profile manager works"""

        published_articles_count = Article.objects.published().count()
        self.assertEqual(published_articles_count, 2)

    def test_community_profile_detail_view(self):
        """Test that community profile detail view works"""
        url = reverse('community-profile-detail',
                      kwargs={'slug': self.published_comm.slug})
        response = self.client.get(url)
        self.assertContains(response, 'published-comm', status_code=200)

        url = reverse('community-profile-detail',
                      kwargs={'slug': self.unpublished_comm.slug})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)

    def test_tips_and_tricks_detail_view(self):
        """Test that tips and tricks detail view works"""
        url = reverse('tips-and-tricks-detail',
                      kwargs={'slug': self.published_tips.slug})
        response = self.client.get(url)
        self.assertContains(response, 'published-tips', status_code=200)

        url = reverse('tips-and-tricks-detail',
                      kwargs={'slug': self.unpublished_tips.slug})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)
